// F3 — Smoke test runner (Activity 6). Started from the front end:
// choose dataset + how many tickets to sample at random; run them through
// triage; return per-ticket results + a mismatch summary. F4: save the run.
import { runTriage, PROMPT_VERSION, getModel } from "@/lib/llm";
import { sampleTickets, type DatasetName } from "@/lib/datasets";
import { estimateCostUsd } from "@/lib/cost";
import { logCall } from "@/lib/logStore";
import { saveRun, type RunItem, type RunRecord } from "@/lib/runStore";
import { mapError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SAMPLE = 25; // smoke tests are small and fast

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const dataset = (body as { dataset?: string })?.dataset;
  const sampleRaw = Number((body as { sample?: unknown })?.sample);
  if (dataset !== "labelled100" && dataset !== "unlabelled500") {
    return Response.json(
      { error: "dataset must be 'labelled100' or 'unlabelled500'." },
      { status: 400 },
    );
  }
  const sample = Math.min(
    Math.max(1, Number.isFinite(sampleRaw) ? Math.floor(sampleRaw) : 5),
    MAX_SAMPLE,
  );

  let tickets;
  try {
    tickets = sampleTickets(dataset as DatasetName, sample);
  } catch {
    return Response.json({ error: "Could not load the dataset." }, { status: 500 });
  }

  const model = getModel();
  const items: RunItem[] = [];
  const outcomes = { ok: 0, invalid_model_output: 0, error: 0 };
  let totalLatency = 0;
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;

  // Sequential: gentle on provider rate limits, keeps the smoke test simple.
  for (const t of tickets) {
    const started = Date.now();
    const labelled =
      dataset === "labelled100" && t.category && t.priority
        ? { category: t.category, priority: t.priority }
        : null;

    try {
      const call = await runTriage(t.subject ?? "", t.body ?? "");
      const latency = Date.now() - started;
      const cost = estimateCostUsd(call.model, call.usage.input, call.usage.output);
      totalLatency += latency;
      totalCost += cost;
      totalInput += call.usage.input;
      totalOutput += call.usage.output;
      outcomes.ok++;

      const predicted = {
        category: call.result.category,
        priority: call.result.priority,
      };
      items.push({
        ticket_id: t.ticket_id,
        outcome: "ok",
        predicted,
        labelled,
        category_match: labelled ? predicted.category === labelled.category : null,
        priority_match: labelled ? predicted.priority === labelled.priority : null,
        latency_ms: latency,
        input_tokens: call.usage.input,
        output_tokens: call.usage.output,
        tags: t.tags,
      });

      logCall({
        ts: new Date().toISOString(),
        route: "triage",
        api: call.api,
        prompt_version: PROMPT_VERSION,
        model: call.model,
        status: 200,
        outcome: "ok",
        input_tokens: call.usage.input,
        output_tokens: call.usage.output,
        total_tokens: call.usage.total,
        cost_usd: cost,
        latency_ms: latency,
      });
    } catch (err) {
      const latency = Date.now() - started;
      totalLatency += latency;
      const mapped = mapError(err);
      const outcomeKey =
        mapped.outcome === "invalid_model_output" ? "invalid_model_output" : "error";
      outcomes[outcomeKey]++;
      items.push({
        ticket_id: t.ticket_id,
        outcome: outcomeKey,
        predicted: null,
        labelled,
        category_match: null,
        priority_match: null,
        latency_ms: latency,
        input_tokens: 0,
        output_tokens: 0,
        tags: t.tags,
      });
      logCall({
        ts: new Date().toISOString(),
        route: "triage",
        api: "chat.completions",
        prompt_version: PROMPT_VERSION,
        model,
        status: mapped.status,
        outcome: mapped.outcome,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cost_usd: 0,
        latency_ms: latency,
      });
    }
  }

  // Accuracy over labelled + successfully-parsed tickets.
  const scored = items.filter((i) => i.labelled && i.predicted);
  const catMatches = scored.filter((i) => i.category_match).length;
  const prioMatches = scored.filter((i) => i.priority_match).length;
  const hasLabels = scored.length > 0;

  const run: RunRecord = {
    run_id: `${new Date().toISOString()}-${PROMPT_VERSION}-${model}`,
    ts: new Date().toISOString(),
    dataset: dataset as DatasetName,
    model,
    prompt_version: PROMPT_VERSION,
    mode: process.env.LLM_STRUCTURED_OUTPUT === "prompt" ? "prompt" : "json_schema",
    sample: tickets.length,
    outcomes,
    category_accuracy: hasLabels ? catMatches / scored.length : null,
    priority_accuracy: hasLabels ? prioMatches / scored.length : null,
    category_mismatches: hasLabels ? scored.length - catMatches : null,
    priority_mismatches: hasLabels ? scored.length - prioMatches : null,
    avg_latency_ms: tickets.length ? Math.round(totalLatency / tickets.length) : 0,
    total_cost_usd: totalCost,
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    items,
  };

  let savedAs = "";
  try {
    savedAs = saveRun(run);
  } catch {
    // saving must not fail the response
  }

  const { items: _omit, ...summary } = run;
  return Response.json({ summary, items, saved_as: savedAs });
}
