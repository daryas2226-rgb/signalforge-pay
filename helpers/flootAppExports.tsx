import type { AppCallContext } from "@floot/apps";
import { z } from "zod";
import superjson from "superjson";
import { paypalSyncService } from "./paypalSyncService";

type SandboxSyncInput = { days: number };
type SandboxSyncCheck = {
  environment: "sandbox";
  httpStatus: number;
  connected: boolean;
  code?: string;
  transactionCount?: number;
  periodCount?: number;
};

/** Owner-only operational verification of the existing private Sandbox sync.
 * Returns status and record counts only; never tokens, passcodes, records or amounts.
 * This is not a public HTTP endpoint and does not create payments.
 */
export async function verifySandboxSync(input: SandboxSyncInput, ctx: AppCallContext): Promise<SandboxSyncCheck> {
  if (!ctx.caller.sameOwner || ctx.caller.appId !== "" || ctx.caller.name !== "Floot MCP") {
    throw new Error("Owner-only diagnostic.");
  }
  const { days } = z.object({ days: z.number().int().min(1).max(31) }).parse(input);
  const passcode = process.env.SIGNALFORGE_SYNC_PASSCODE;
  if (!passcode) return { environment: "sandbox", httpStatus: 503, connected: false, code: "PAYPAL_NOT_CONNECTED" };
  const response = await paypalSyncService(new Request("https://signalforge-pay.floot.app/_api/paypal-sync", {
    method: "POST",
    body: superjson.stringify({ days, syncPasscode: passcode }),
  }));
  const result = superjson.parse<Record<string, unknown>>(await response.text());
  return {
    environment: "sandbox", httpStatus: response.status,
    connected: response.ok && result.connected === true,
    ...(typeof result.code === "string" ? { code: result.code } : {}),
    ...(response.ok && typeof result.transactionCount === "number" ? { transactionCount: result.transactionCount } : {}),
    ...(response.ok && Array.isArray(result.periods) ? { periodCount: result.periods.length } : {}),
  };
}