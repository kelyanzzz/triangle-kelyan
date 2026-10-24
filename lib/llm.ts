// The single LLM module (Activity 7: routes call this, components never do).
// One OpenAI-compatible client, built from environment variables. Only the
// server reads the key.
import OpenAI from "openai";
import {
  TriageSchema,
  jsonSchema,
  type TriageResult,
  type TokenUsage,
} from "./schema";
import {
  SYSTEM_PROMPT,
  buildTicketText,
  buildUserMessage,
  PROMPT_VERSION,
} from "./prompt";

// ---- Typed errors, mapped to HTTP statuses in the routes (Activity 4) ----
export class LlmConfigError extends Error {}
export class LlmInvalidOutputError extends Error {} // invalid JSON or schema mismatch

// ---- Client ------------------------------------------------------------
let client: OpenAI | null = null;
function getClient(): OpenAI {
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL;
  if (!apiKey || !baseURL) {
    throw new LlmConfigError("LLM is not configured (LLM_BASE_URL / LLM_API_KEY).");
  }
  if (!client) {
    // timeout and retries set explicitly (Activity 7). Timeout is per attempt.
    client = new OpenAI({ apiKey, baseURL, timeout: 30_000, maxRetries: 2 });
  }
  return client;
}

export function getModel(): string {
  return process.env.LLM_MODEL || "llama-3.3-70b-versatile";
}

function structuredMode(): "json_schema" | "prompt" {
  return process.env.LLM_STRUCTURED_OUTPUT === "prompt" ? "prompt" : "json_schema";
}

// A model asked nicely can still wrap JSON in a ```json fence. Strip it.
function stripCodeFence(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  return t;
}

// ---- Chat (Activity 1 + 2): real LLM, keeps history, stateless server ----
export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function chat(
  message: string,
  history: ChatTurn[] = [],
): Promise<{ answer: string; usage: TokenUsage; model: string }> {
  const openai = getClient();
  const model = getModel();
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.3,
    messages: [
      { role: "system", content: "You are a concise, helpful support assistant." },
      ...history,
      { role: "user", content: message },
    ],
  });
  const answer = completion.choices[0]?.message?.content ?? "";
  const u = completion.usage;
  return {
    answer,
    model: completion.model || model,
    usage: {
      input: u?.prompt_tokens ?? 0,
      output: u?.completion_tokens ?? 0,
      total: u?.total_tokens ?? 0,
    },
  };
}

// ---- Triage V2 (Activity 4): ASK for the format, then CHECK it ----------
export type TriageCall = {
  result: TriageResult;
  usage: TokenUsage;
  model: string;
  api: "chat.completions";
  mode: "json_schema" | "prompt";
  cutOff: boolean;
};

export async function runTriage(subject: string, body: string): Promise<TriageCall> {
  const openai = getClient();
  const model = getModel();
  const mode = structuredMode();
  const ticketText = buildTicketText(subject, body);

  const systemContent =
    mode === "prompt"
      ? `${SYSTEM_PROMPT}\n\nReturn a single JSON object with exactly these keys: category, priority, summary, suggested_action. No markdown, no code fence.`
      : SYSTEM_PROMPT;

  const base = {
    model,
    temperature: 0,
    messages: [
      { role: "system" as const, content: systemContent },
      { role: "user" as const, content: buildUserMessage(ticketText) },
    ],
  };

  // Use 1 (ASK): send the schema (or ask in prose). Fall back to json_object
  // if the provider does not support json_schema for this model.
  let completion;
  if (mode === "json_schema") {
    try {
      completion = await openai.chat.completions.create({
        ...base,
        response_format: {
          type: "json_schema",
          json_schema: { name: "support_triage", strict: true, schema: jsonSchema },
        },
      });
    } catch (err) {
      if (isUnsupportedFormat(err)) {
        completion = await openai.chat.completions.create({
          ...base,
          response_format: { type: "json_object" },
        });
      } else {
        throw err;
      }
    }
  } else {
    completion = await openai.chat.completions.create({
      ...base,
      response_format: { type: "json_object" },
    });
  }

  // Use 2 (CHECK): from the response to text, then text to a trusted value.
  const choice = completion.choices[0];
  const text = choice?.message?.content ?? "";
  const cutOff = choice?.finish_reason === "length";

  let raw: unknown;
  try {
    raw = JSON.parse(stripCodeFence(text));
  } catch {
    throw new LlmInvalidOutputError("not JSON");
  }
  const parsed = TriageSchema.safeParse(raw);
  if (!parsed.success) {
    throw new LlmInvalidOutputError("schema mismatch");
  }

  const u = completion.usage;
  return {
    result: parsed.data,
    model: completion.model || model,
    api: "chat.completions",
    mode,
    cutOff,
    usage: {
      input: u?.prompt_tokens ?? 0,
      output: u?.completion_tokens ?? 0,
      total: u?.total_tokens ?? 0,
    },
  };
}

export { PROMPT_VERSION };

// Detect a provider rejecting json_schema so we can fall back.
function isUnsupportedFormat(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
  return (
    status === 400 &&
    (msg.includes("response_format") ||
      msg.includes("json_schema") ||
      msg.includes("schema"))
  );
}
