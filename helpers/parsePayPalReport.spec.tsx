import { parsePayPalReport } from "./parsePayPalReport";

const row = (code:string, amount:string, date:string, currency = "USD") => ({
  transaction_info: {transaction_event_code:code, transaction_status:"S",
    transaction_amount:{value:amount,currency_code:currency},
    fee_amount:{value:code==="T0006"?"-2":"0"},transaction_initiation_date:date},
});
describe("client-only PayPal-format importer", () => {
  it("converts synthetic PayPal JSON into six time buckets", () => {
    const data = {transaction_details:[
      row("T0006","100","2026-10-01T12:00:00Z"),
      row("T0006","180","2026-10-19T12:00:00Z"),
      row("T1107","-40","2026-10-20T12:00:00Z"),
      row("T1201","-30","2026-10-20T13:00:00Z"),
    ]};
    const result = parsePayPalReport(JSON.stringify(data));
    expect(result.periods.length).toBe(6);
    expect(result.currency).toBe("USD");
    expect(result.periods.reduce((s,p)=>s+p.gross,0)).toBe(280);
    expect(result.periods.reduce((s,p)=>s+p.refunds,0)).toBe(70);
    expect(result.periods.reduce((s,p)=>s+p.disputes,0)).toBe(1);
    expect(result.periods.reduce((s,p)=>s+p.fees,0)).toBe(4);
  });
  it("rejects mixing currencies without conversion", () => {
    const data = {transaction_details:[
      row("T0006","100","2026-10-01T12:00:00Z","USD"),
      row("T0006","100","2026-10-02T12:00:00Z","EUR")]};
    expect(() => parsePayPalReport(JSON.stringify(data))).toThrow(new Error(
      "A report must contain exactly one currency. Mixed or missing currency data cannot be analyzed safely."));
  });
  it("rejects malformed or empty JSON", () => {
    expect(() => parsePayPalReport("{")).toThrow(new Error("This file is not valid JSON."));
    expect(() => parsePayPalReport("{}")).toThrow();
  });
  it("rejects data without a known merchant event", () => {
    const data = {transaction_details:[row("T1500","-20","2026-10-02T12:00:00Z")]};
    expect(() => parsePayPalReport(JSON.stringify(data))).toThrow();
  });
});