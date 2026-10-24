// Activity 5 — Step 1: log one line per LLM call to logs/llm-calls.jsonl.
// One request = one line. Never log the key, never log the full ticket text.
import fs from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "llm-calls.jsonl");

export type CallLog = {
  ts: string;
  route: "chat" | "triage" | "triage/explain";
  api: string; // e.g. "chat.completions"
  prompt_version: string;
  model: string;
  status: number; // HTTP status we returned
  outcome: string; // "ok" | "invalid_model_output" | "rate_limited" | ...
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
};

export function logCall(entry: CallLog): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // logging must never break the request
  }
}

export function readCalls(): CallLog[] {
  try {
    const raw = fs.readFileSync(LOG_FILE, "utf8");
    return raw
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l) as CallLog;
        } catch {
          return null;
        }
      })
      .filter((x): x is CallLog => x !== null);
  } catch {
    return [];
  }
}
