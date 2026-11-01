/** Conservative merchant-finance mapping for PayPal Transaction Search events.
 * Unknown, hold, transfer, tax and payout types are intentionally excluded
 * from gross sales rather than silently added to revenue.
 * Reference: https://developer.paypal.com/reports/reference/t-codes/
 */
export type TransactionInfo = {
  transaction_event_code?: string;
  transaction_status?: string;
  transaction_amount?: { value?: string; currency_code?: string };
  fee_amount?: { value?: string; currency_code?: string };
};

export type FinancialEvent = {
  kind: "sale" | "refund" | "chargeback" | "ignored";
  amount: number;
  fee: number;
};

const SALE_CODES = new Set([
  "T0000", "T0002", "T0003", "T0005", "T0006", "T0007",
  "T0011", "T0012", "T0013", "T0018", "T0023",
]);
const REFUND_CODES = new Set(["T1106", "T1107", "T1120"]);

export function classifyMerchantEvent(info?: TransactionInfo): FinancialEvent {
  const ignored: FinancialEvent = { kind: "ignored", amount: 0, fee: 0 };
  if (!info) return ignored;
  const amount = Number(info.transaction_amount?.value);
  const fee = Number(info.fee_amount?.value || 0);
  if (!Number.isFinite(amount) || !Number.isFinite(fee)) return ignored;
  const code = info.transaction_event_code || "";

  // T1201 is a chargeback; T15xx are holds, not disputes.
  if (code === "T1201" && amount < 0) {
    return { kind: "chargeback", amount: Math.abs(amount), fee: 0 };
  }
  if (REFUND_CODES.has(code) && amount < 0) {
    return { kind: "refund", amount: Math.abs(amount), fee: 0 };
  }
  // Status V means a previously successful payment was reversed; its gross
  // sale is still reported, with the offsetting reversal in a separate row.
  if (SALE_CODES.has(code) && ["S", "V"].includes(info.transaction_status || "") && amount > 0) {
    return { kind: "sale", amount, fee: Math.abs(fee) };
  }
  return ignored;
}
