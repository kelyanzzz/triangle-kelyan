// Activity 6 / F4 — each smoke run is saved to runs/<date>-<prompt>-<model>.json
// and listed on /admin with accuracy, outcome counts, latency, cost and model.
import fs from "node:fs";
import path from "node:path";

const RUNS_DIR = path.join(process.cwd(), "runs");

export type RunItem = {
  ticket_id: string;
  outcome: "ok" | "invalid_model_output" | "error";
  predicted: { category: string; priority: string } | null;
  labelled: { category: string; priority: string } | null;
  category_match: boolean | null;
  priority_match: boolean | null;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  tags?: string;
};

export type RunSummary = {
  run_id: string;
  ts: string;
  dataset: "labelled100" | "unlabelled500";
  model: string;
  prompt_version: string;
  mode: string;
  sample: number;
  outcomes: { ok: number; invalid_model_output: number; error: number };
  category_accuracy: number | null; // labelled only
  priority_accuracy: number | null;
  category_mismatches: number | null;
  priority_mismatches: number | null;
  avg_latency_ms: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
};

export type RunRecord = RunSummary & { items: RunItem[] };

function safe(part: string): string {
  return part.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function saveRun(run: RunRecord): string {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const date = run.ts.slice(0, 19).replace(/[:T]/g, "-");
  const file = path.join(
    RUNS_DIR,
    `${date}-${safe(run.prompt_version)}-${safe(run.model)}.json`,
  );
  fs.writeFileSync(file, JSON.stringify(run, null, 2), "utf8");
  return path.basename(file);
}

export function listRunSummaries(): RunSummary[] {
  try {
    const files = fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith(".json"));
    const out: RunSummary[] = [];
    for (const f of files) {
      try {
        const rec = JSON.parse(
          fs.readFileSync(path.join(RUNS_DIR, f), "utf8"),
        ) as RunRecord;
        const { items, ...summary } = rec;
        out.push(summary);
      } catch {
        // skip bad file
      }
    }
    return out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  } catch {
    return [];
  }
}
