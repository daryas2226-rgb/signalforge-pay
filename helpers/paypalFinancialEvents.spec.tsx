import { classifyMerchantEvent } from "./paypalFinancialEvents";

describe("PayPal merchant-finance event classification", () => {
  it("counts successful merchant checkout and processing fee", () => {
    expect(classifyMerchantEvent({transaction_event_code:"T0006",transaction_status:"S",
      transaction_amount:{value:"125.00"},fee_amount:{value:"-3.12"}}))
      .toEqual({kind:"sale",amount:125,fee:3.12});
  });
  it("preserves original gross for a subsequently reversed payment", () => {
    expect(classifyMerchantEvent({transaction_event_code:"T0006",transaction_status:"V",
      transaction_amount:{value:"125"}}).kind).toBe("sale");
  });
  it("captures merchant refunds without inflating gross revenue", () => {
    expect(classifyMerchantEvent({transaction_event_code:"T1107",transaction_status:"S",
      transaction_amount:{value:"-45"}}))
      .toEqual({kind:"refund",amount:45,fee:0});
  });
  it("counts actual chargebacks and avoids treating holds as disputes", () => {
    expect(classifyMerchantEvent({transaction_event_code:"T1201",transaction_status:"S",
      transaction_amount:{value:"-30"}}).kind).toBe("chargeback");
    expect(classifyMerchantEvent({transaction_event_code:"T1500",transaction_status:"S",
      transaction_amount:{value:"-90"}}).kind).toBe("ignored");
  });
  it("excludes payouts and tax instead of calling them sales", () => {
    expect(classifyMerchantEvent({transaction_event_code:"T0015",transaction_status:"S",
      transaction_amount:{value:"500"}}).kind).toBe("ignored");
    expect(classifyMerchantEvent({transaction_event_code:"T0020",transaction_status:"S",
      transaction_amount:{value:"50"}}).kind).toBe("ignored");
  });
  it("does not accept missing or nonnumeric amounts as sales", () => {
    expect(classifyMerchantEvent({transaction_event_code:"T0006",transaction_status:"S",
      transaction_amount:{value:"not-money"}}).kind).toBe("ignored");
  });
});