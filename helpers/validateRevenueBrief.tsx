import { z } from "zod";
const text = z.string().trim().min(1).max(6000);
const schema = z.object({
  whatChanged: text, investigation: text, whatNext: text,
  risks: z.array(text).min(1).max(3), opportunities: z.array(text).min(1).max(3),
  actions: z.array(z.object({action:text, rationale:text, confidence:z.enum(["High","Medium","Low"])})).length(3),
  guardrail: text,
});
/** Reject incomplete model output instead of inventing a successful brief. */
export function validateRevenueBrief(value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("AI returned an incomplete brief. Please try again.");
  return result.data;
}