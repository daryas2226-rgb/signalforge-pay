import type { Period } from "../endpoints/paypal-sync_POST.schema";
import { classifyMerchantEvent, type TransactionInfo } from "./paypalFinancialEvents";

export type ImportedReport = { periods: Period[]; currency: string; transactionCount: number };
type ReportRow = { transaction_info?: TransactionInfo & { transaction_initiation_date?: string } };

/** Parse a PayPal Transaction Search-shaped JSON export entirely in the browser.
 * Never upload individual transaction records to our app or AI service.
 */
export function parsePayPalReport(text: string): ImportedReport {
  if (text.length > 2_000_000) throw new Error("JSON is too large (2 MB maximum).");
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  const rows: ReportRow[] = Array.isArray(data) ? data : data?.transaction_details;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 5000) {
    throw new Error("Expected 1–5,000 PayPal Transaction Search rows in transaction_details.");
  }
  const records = rows.map(row => {
    const info = row?.transaction_info;
    const time = new Date(info?.transaction_initiation_date || "").getTime();
    return { info, time, event: classifyMerchantEvent(info) };
  }).filter(x => Number.isFinite(x.time) && x.event.kind !== "ignored");

  if (records.length < 1) {
    throw new Error("No supported sale, refund or chargeback events with valid dates were found.");
  }
  const currencies = new Set(records.map(r => r.info?.transaction_amount?.currency_code).filter(Boolean));
  if (currencies.size !== 1) {
    throw new Error("A report must contain exactly one currency. Mixed or missing currency data cannot be analyzed safely.");
  }
  const currency = [...currencies][0]!;
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid three-letter currency code.");
  const end = Math.max(...records.map(r => r.time)) + 1000;
  const start = end - 30 * 86_400_000;
  const count = 6;
  const bucketMs = (end - start) / count;
  const fmt = new Intl.DateTimeFormat("en-US", {month:"short",day:"2-digit",timeZone:"UTC"});
  const periods: Period[] = Array.from({length:count}, (_,i) => {
    const a = new Date(start + bucketMs * i);
    const b = new Date(start + bucketMs * (i+1));
    return {label:`${fmt.format(a)}–${fmt.format(b)}`,gross:0,refunds:0,fees:0,transactions:0,failed:0,disputes:0};
  });

  for (const rec of records) {
    if (rec.time < start || rec.time >= end) continue;
    const bin = periods[Math.min(count - 1, Math.floor((rec.time - start) / bucketMs))];
    if (rec.event.kind === "sale") {
      bin.gross += rec.event.amount;
      bin.fees += rec.event.fee;
      bin.transactions++;
    } else if (rec.event.kind === "refund" || rec.event.kind === "chargeback") {
      bin.refunds += rec.event.amount;
      if (rec.event.kind === "chargeback") bin.disputes++;
    }
  }
  for (const bin of periods) {
    bin.gross = Math.round(bin.gross * 100) / 100;
    bin.fees = Math.round(bin.fees * 100) / 100;
    bin.refunds = Math.round(bin.refunds * 100) / 100;
  }
  return { periods, currency, transactionCount: records.length };
}
