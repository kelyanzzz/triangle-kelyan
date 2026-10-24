// F1 — the contract, written once in Zod, used in two places (Activity 4):
//   Use 1 (ASK)   : z.toJSONSchema(TriageSchema) is sent to the provider.
//   Use 2 (CHECK) : TriageSchema.safeParse(...) validates whatever comes back,
//                   at our border, before it reaches the user.
import { z } from "zod";

// Fixed vocabularies (match the labelled dataset).
export const CATEGORIES = [
  "billing",
  "technical_bug",
  "account",
  "feature_request",
] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];

// ---- Triage response contract ------------------------------------------
export const TriageSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  summary: z.string().min(1).max(300),
  suggested_action: z.string().min(1).max(500),
});
export type TriageResult = z.infer<typeof TriageSchema>;

// Use 1 (ASK): the same contract as a JSON Schema sent to the provider.
// We force strict-mode shape (all keys required, no extra keys) so providers
// that support json_schema enforce exactly our contract while generating.
function toStrictJsonSchema() {
  const { $schema, ...rest } = z.toJSONSchema(TriageSchema) as Record<
    string,
    unknown
  >;
  const props = (rest.properties ?? {}) as Record<string, unknown>;
  return {
    ...rest,
    type: "object",
    properties: props,
    required: Object.keys(props),
    additionalProperties: false,
  };
}
export const jsonSchema = toStrictJsonSchema();

// ---- Triage request contract (F1) --------------------------------------
// Each incoming request also follows a schema. Over-long tickets are rejected
// here with 400 — never forwarded to the provider (security checkpoint).
export const MAX_SUBJECT_CHARS = 1000;
export const MAX_BODY_CHARS = 8000;

export const TriageRequestSchema = z.object({
  subject: z.string().min(1).max(MAX_SUBJECT_CHARS),
  body: z.string().min(1).max(MAX_BODY_CHARS),
});
export type TriageRequestInput = z.infer<typeof TriageRequestSchema>;

// ---- Token usage (F2) --------------------------------------------------
export type TokenUsage = { input: number; output: number; total: number };
