import superjson from "superjson";
import { handle } from "../endpoints/paypal-sync_POST";

const code = (event:string, value:string, date:string, fee = "0") => ({
  transaction_info: {
    transaction_id: `MOCK-${event}-${value}`,
    transaction_event_code: event,
    transaction_status: "S",
    transaction_amount: {value,currency_code:"USD"},
    fee_amount: {value:fee,currency_code:"USD"},
    transaction_initiation_date:date,
  },
});

describe("PayPal server sync integration (mocked API, NO real money)", () => {
  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = "test-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-secret";
    process.env.SIGNALFORGE_SYNC_PASSCODE = "testing-only-private-sync-passcode";
  });

  afterEach(() => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.SIGNALFORGE_SYNC_PASSCODE;
  });

  it("rejects an incorrect owner passcode without calling PayPal", async () => {
    const mock = spyOn(globalThis, "fetch");
    const req = new Request("https://test.local/_api/paypal-sync", {
      method:"POST",body:superjson.stringify({days:30,syncPasscode:"this-one-is-not-the-real-passcode"}),
    });
    const result = await handle(req);
    expect(result.status).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });

  it("aggregates sales, refunds and chargebacks with mocked OAuth and reporting", async () => {
    const now = new Date(Date.now() - 2 * 24 * 3600000).toISOString();
    const fake = spyOn(globalThis,"fetch").and.callFake(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/oauth2/token")) return new Response(JSON.stringify({access_token:"MOCK-TOKEN"}),{status:200});
      if (url.includes("/reporting/transactions")) {
        return new Response(JSON.stringify({
          total_pages:1,
          transaction_details:[
            code("T0006","100",now,"-3"),
            code("T1107","-20",now),
            code("T1201","-30",now),
            code("T1500","-70",now),
          ],
        }),{status:200});
      }
      throw new Error("Unexpected mocked API request: " + url);
    });
    const req = new Request("https://test.local/_api/paypal-sync", {
      method:"POST",body:superjson.stringify({days:30,syncPasscode:"testing-only-private-sync-passcode"}),
    });
    const result = await handle(req);
    expect(result.status).toBe(200);
    const output:any = superjson.parse(await result.text());
    expect(output.source).toBe("paypal-sandbox");
    expect(output.transactionCount).toBe(4);
    expect(output.periods.reduce((x:number,y:any)=>x+y.gross,0)).toBe(100);
    expect(output.periods.reduce((x:number,y:any)=>x+y.refunds,0)).toBe(50);
    expect(output.periods.reduce((x:number,y:any)=>x+y.fees,0)).toBe(3);
    expect(output.periods.reduce((x:number,y:any)=>x+y.disputes,0)).toBe(1);
    expect(fake).toHaveBeenCalledTimes(2);
  });
});
