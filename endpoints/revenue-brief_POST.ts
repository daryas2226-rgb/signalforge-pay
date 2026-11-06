import superjson from "superjson";
import { flootAi, FlootAiOutOfCreditsError } from "@floot/ai";
import { schema, type OutputType } from "./revenue-brief_POST.schema";
import { db } from "../helpers/db";
import { sql } from "kysely";
import { createHash } from "node:crypto";
import { validateRevenueBrief } from "../helpers/validateRevenueBrief";

class RateLimitExceeded extends Error {}

// Durable atomic limits; serverless function instances do not share memory.
// Even spoofed client headers cannot bypass the global hourly budget.
async function reserveAiRequest(request: Request): Promise<boolean> {
  const ip = (request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]
    || "unknown").trim().slice(0, 80);
  const fingerprint = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  const hour = Math.floor(Date.now() / 3_600_000);
  try {
    await db.transaction().execute(async tx => {
      for (const [scope, limit] of [["global", 40], [`client:${fingerprint}`, 6]] as const) {
        const attempt = await sql<{ used: number }>`
          INSERT INTO ai_request_budgets (scope, bucket, used)
          VALUES (${scope}, ${hour}, 1)
          ON CONFLICT (scope, bucket)
          DO UPDATE SET used = ai_request_budgets.used + 1
          WHERE ai_request_budgets.used < ${limit}
          RETURNING used
        `.execute(tx);
        if (attempt.rows.length === 0) throw new RateLimitExceeded();
      }
    });
    return true;
  } catch (error) {
    if (error instanceof RateLimitExceeded) return false;
    console.error("AI usage budget is unavailable");
    throw new Error("AI_USAGE_STORE_UNAVAILABLE"); // Fail closed, without charging credits.
  }
}

function extractText(result: any): string {
  return (result.output ?? [])
    .filter((o: any) => o.type === "message")
    .flatMap((o: any) => o.content ?? [])
    .filter((c: any) => c.type === "output_text")
    .map((c: any) => c.text)
    .join("\n");
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI response did not contain valid JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

export async function handle(request: Request) {
  try {
    const input = schema.parse(superjson.parse(await request.text()));
    if (!await reserveAiRequest(request)) {
      return new Response(superjson.stringify({
        error: "Demo AI request limit reached. Please try again later.",
        code: "AI_RATE_LIMITED",
      }), { status: 429 });
    }
    const evidence = {
      dataSource: input.source,
      currency: input.currency,
      latestGross: input.latestGross,
      netRevenue: input.netRevenue,
      changeVsPreviousPercent: input.changeVsPrevPct,
      multiPeriodTrendPercentPerPeriod: input.trendPct,
      nextPeriodForecast: input.forecast,
      refundRatePercent: input.refundRatePct,
      paymentFailureRatePercent: input.failureRatePct,
      paymentFailureDataCoverage: input.source === "demo"
        ? "Simulated demo counts"
        : "PayPal-format transactions and balance-affecting records do not provide complete checkout failure counts. Do not infer real checkout failure rate from these fields.",
      completedPayments: input.completedPayments,
      failedPayments: input.failedPayments,
      disputes: input.disputes,
      anomalySummary: input.anomalySummary,
    };

    const result = await flootAi.chat({
      model: "gpt-6-luna",
      reasoning: { effort: "low" },
      instructions: [
        "You are the decision-intelligence layer of SignalForge Pay, a small-business revenue tool.",
        "Use ONLY the quantitative evidence supplied. Never invent transaction facts.",
        "If PayPal Sandbox or user-imported PayPal-format data is used, never claim the failed checkout rate is known from the Transaction Search feed.",
        "If source is imported-file, say the report was supplied locally and authenticity or provenance is not verified.",
        "Separate evidence from hypotheses. Correlation or co-occurrence is never proof of causation.",
        "Return concise JSON only with keys: whatChanged, investigation, whatNext, risks, opportunities, actions, guardrail.",
        "risks and opportunities must each be arrays of 1-3 strings.",
        "actions must contain exactly 3 objects with action, rationale, confidence. confidence must be High, Medium, or Low.",
        "Recommended actions should be reversible and should validate uncertain causes before costly changes.",
      ].join(" "),
      input: `Revenue evidence:\n${JSON.stringify(evidence, null, 2)}`,
      max_output_tokens: 1400,
    });

    const validated = validateRevenueBrief(extractJson(extractText(result)));
    const output: OutputType = { ...validated, model: "gpt-6-luna via Floot AI" };
    return new Response(superjson.stringify(output), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    if (error instanceof Error && error.message === "AI_USAGE_STORE_UNAVAILABLE") {
      return new Response(superjson.stringify({
        error: "AI demo is temporarily unavailable. Usage safety check could not complete.",
        code: "AI_BUDGET_UNAVAILABLE",
      }), { status: 503 });
    }
    if (error instanceof FlootAiOutOfCreditsError) {
      return new Response(superjson.stringify({
        error: "AI features are temporarily unavailable.",
        code: "OUT_OF_CREDITS",
      }), { status: 503 });
    }
    console.error("Revenue brief generation failed");
    return new Response(superjson.stringify({
      error: "Could not generate a complete revenue brief. Please try again.",
      code: "AI_BRIEF_FAILED",
    }), { status: 400 });
  }
}