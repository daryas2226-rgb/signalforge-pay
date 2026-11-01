import superjson from "superjson";
import { timingSafeEqual } from "node:crypto";
import { schema, type OutputType, type Period } from "./paypal-sync_POST.schema";
import { classifyMerchantEvent } from "../helpers/paypalFinancialEvents";

type PayPalMoney = { value?: string; currency_code?: string };
type PayPalTransaction = {
  transaction_info?: {
    transaction_id?: string;
    transaction_event_code?: string;
    transaction_initiation_date?: string;
    transaction_amount?: PayPalMoney;
    fee_amount?: PayPalMoney;
    transaction_status?: string;
  };
};

type PayPalSearchResponse = {
  transaction_details?: PayPalTransaction[];
  total_pages?: number;
};

function iso(d: Date) {
  return d.toISOString();
}

function bucketLabel(start: Date, end: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", timeZone: "UTC" });
  return `${fmt.format(start)}–${fmt.format(end)}`;
}

export async function handle(request: Request) {
  try {
    const input = schema.parse(superjson.parse(await request.text()));
    const env = process.env as Record<string, string | undefined>;
    const clientId = env.PAYPAL_CLIENT_ID;
    const clientSecret = env.PAYPAL_CLIENT_SECRET;
    const syncPasscode = env.SIGNALFORGE_SYNC_PASSCODE;
    if (!clientId || !clientSecret || !syncPasscode) {
      return new Response(superjson.stringify({
        error: "PayPal Sandbox credentials are not connected yet.",
        code: "PAYPAL_NOT_CONNECTED",
      }), { status: 503 });
    }

    // A public demo must NEVER expose a connected merchant's payment history.
    // Keep the owner-only passcode server-side and compare it in constant time.
    const provided = Buffer.from(input.syncPasscode);
    const required = Buffer.from(syncPasscode);
    if (provided.length !== required.length || !timingSafeEqual(provided, required)) {
      return new Response(superjson.stringify({
        error: "Incorrect private sync passcode.",
        code: "PAYPAL_SYNC_UNAUTHORIZED",
      }), { status: 401 });
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenResponse = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!tokenResponse.ok) {
      const details = await tokenResponse.text();
      console.error("PayPal OAuth failed", tokenResponse.status, details.slice(0, 500));
      return new Response(superjson.stringify({
        error: "PayPal Sandbox authentication failed. Check the Sandbox Client ID and Secret.",
        code: "PAYPAL_AUTH_FAILED",
      }), { status: 502 });
    }

    const token = await tokenResponse.json() as { access_token?: string; scope?: string };
    if (!token.access_token) {
      return new Response(superjson.stringify({
        error: "PayPal did not return an access token.",
        code: "PAYPAL_AUTH_FAILED",
      }), { status: 502 });
    }

    // Check the granted scope, never log or expose OAuth access tokens.
    const hasReportingScope = (token.scope ?? "").split(/\s+/).includes("https://uri.paypal.com/services/reporting/search/read");
    if (token.scope && !hasReportingScope) {
      return new Response(superjson.stringify({
        error: "PayPal authenticated, but the issued OAuth token does not include Transaction Search permission. Confirm this Sandbox app's Features, then allow PayPal to refresh its cached grants.",
        code: "PAYPAL_REPORTING_SCOPE_MISSING",
      }), { status: 502 });
    }

    const end = new Date();
    const start = new Date(end.getTime() - input.days * 24 * 60 * 60 * 1000);
    const transactions: PayPalTransaction[] = [];
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page++) {
      // Never silently truncate the financial report.
      if (page > 10) {
        return new Response(superjson.stringify({
          error: "More than 5,000 transactions in this period. Please shorten the range before analysis.",
          code: "PAYPAL_TOO_MANY_TRANSACTIONS",
        }), { status: 422 });
      }
      const url = new URL("https://api-m.sandbox.paypal.com/v1/reporting/transactions");
      url.searchParams.set("start_date", iso(start));
      url.searchParams.set("end_date", iso(end));
      url.searchParams.set("fields", "transaction_info");
      url.searchParams.set("page_size", "500");
      url.searchParams.set("page", String(page));
      url.searchParams.set("balance_affecting_records_only", "Y");
      const txResponse = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: "application/json",
          "PayPal-Enforce-ISO8601-Format": "true",
        },
      });
      if (!txResponse.ok) {
        console.error("PayPal Transaction Search failed", txResponse.status);
        return new Response(superjson.stringify({
          error: txResponse.status === 403
            ? "The Sandbox app lacks access to PayPal Transaction Search."
            : "PayPal Sandbox transaction sync failed.",
          code: txResponse.status === 403 ? "PAYPAL_REPORTING_PERMISSION" : "PAYPAL_SYNC_FAILED",
        }), { status: 502 });
      }
      const data = await txResponse.json() as PayPalSearchResponse;
      transactions.push(...(data.transaction_details ?? []));
      totalPages = Math.max(1, data.total_pages ?? 1);
    }
    const bucketCount = 6;
    const rangeMs = end.getTime() - start.getTime();
    const bucketMs = Math.max(rangeMs / bucketCount, 1);
    const periods: Period[] = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = new Date(start.getTime() + i * bucketMs);
      const bucketEnd = new Date(i === bucketCount - 1 ? end.getTime() : start.getTime() + (i + 1) * bucketMs);
      return {
        label: bucketLabel(bucketStart, bucketEnd),
        gross: 0,
        refunds: 0,
        fees: 0,
        transactions: 0,
        failed: 0,
        disputes: 0,
      };
    });

    const currencies = new Set(transactions
      .filter(t => classifyMerchantEvent(t.transaction_info).kind !== "ignored")
      .map(t => t.transaction_info?.transaction_amount?.currency_code)
      .filter(Boolean));
    if (currencies.size > 1) {
      return new Response(superjson.stringify({
        error: "Multiple currencies were detected. This dashboard does not combine currencies without conversion. Filter data to a single currency.",
        code: "PAYPAL_MULTICURRENCY",
      }), { status: 422 });
    }
    let currency = [...currencies][0] || "USD";
    for (const item of transactions) {
      const info = item.transaction_info;
      if (!info?.transaction_initiation_date) continue;
      const ts = new Date(info.transaction_initiation_date).getTime();
      if (!Number.isFinite(ts)) continue;
      const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((ts - start.getTime()) / bucketMs)));
      const event = classifyMerchantEvent(info);
      if (event.kind === "chargeback") {
        periods[index].refunds += event.amount;
        periods[index].disputes += 1;
      } else if (event.kind === "refund") {
        periods[index].refunds += event.amount;
      } else if (event.kind === "sale") {
        periods[index].gross += event.amount;
        periods[index].transactions += 1;
        periods[index].fees += event.fee;
      }
    }

    const output: OutputType = {
      source: "paypal-sandbox",
      connected: true,
      transactionCount: transactions.length,
      currency,
      range: { start: iso(start), end: iso(end) },
      periods: periods.map(p => ({
        ...p,
        gross: Number(p.gross.toFixed(2)),
        refunds: Number(p.refunds.toFixed(2)),
        fees: Number(p.fees.toFixed(2)),
      })),
    };
    return new Response(superjson.stringify(output), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error(error);
    return new Response(superjson.stringify({
      error: error instanceof Error ? error.message : "Invalid PayPal sync request.",
      code: "PAYPAL_SYNC_FAILED",
    }), { status: 400 });
  }
}
