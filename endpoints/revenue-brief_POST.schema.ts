import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  source: z.enum(["demo", "paypal-sandbox", "imported-file"]),
  currency: z.string().min(3).max(3),
  latestGross: z.number(),
  netRevenue: z.number(),
  changeVsPrevPct: z.number(),
  trendPct: z.number(),
  forecast: z.number(),
  refundRatePct: z.number(),
  failureRatePct: z.number(),
  completedPayments: z.number().int().nonnegative(),
  failedPayments: z.number().int().nonnegative(),
  disputes: z.number().int().nonnegative(),
  anomalySummary: z.string().max(1000),
});

export type OutputType = {
  whatChanged: string;
  investigation: string;
  whatNext: string;
  risks: string[];
  opportunities: string[];
  actions: { action: string; rationale: string; confidence: "High" | "Medium" | "Low" }[];
  guardrail: string;
  model: string;
};

export async function postRevenueBrief(body: z.infer<typeof schema>, init?: RequestInit): Promise<OutputType> {
  const validatedInput = schema.parse(body);
  const result = await fetch("/_api/revenue-brief", {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; code?: string }>(await result.text());
    const error = new Error(errorObject.error);
    (error as Error & { code?: string }).code = errorObject.code;
    throw error;
  }
  return superjson.parse<OutputType>(await result.text());
}