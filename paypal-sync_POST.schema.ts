import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  days: z.number().int().min(1).max(31),
  syncPasscode: z.string().min(16).max(256),
});

export type Period = {
  label: string;
  gross: number;
  refunds: number;
  fees: number;
  transactions: number;
  failed: number;
  disputes: number;
};

export type OutputType = {
  source: "paypal-sandbox";
  connected: true;
  transactionCount: number;
  currency: string;
  range: { start: string; end: string };
  periods: Period[];
};

export async function postPaypalSync(body: z.infer<typeof schema>, init?: RequestInit): Promise<OutputType> {
  const validatedInput = schema.parse(body);
  const result = await fetch("/_api/paypal-sync", {
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
