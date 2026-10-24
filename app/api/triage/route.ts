// Triage V2 (Activity 3 + 4) — POST { subject, body }.
// F1: request + response validated with Zod. F2: token usage returned.
// Errors mapped to the failure table; one line logged per call.
import { runTriage, PROMPT_VERSION } from "@/lib/llm";
import { TriageRequestSchema } from "@/lib/schema";
import { estimateCostUsd } from "@/lib/cost";
import { logCall } from "@/lib/logStore";
import { mapError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const started = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // F1: validate the request against the schema. Over-long tickets -> 400,
  // never forwarded to the provider.
  const parsed = TriageRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { error: first ? `${first.path.join(".")}: ${first.message}` : "Invalid request." },
      { status: 400 },
    );
  }

  const { subject, body: ticketBody } = parsed.data;

  try {
    const call = await runTriage(subject, ticketBody);
    const cost = estimateCostUsd(call.model, call.usage.input, call.usage.output);

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
      latency_ms: Date.now() - started,
    });

    // F2: usage returned so the front end can display it.
    return Response.json({
      triage: call.result,
      usage: call.usage,
      cost_usd: cost,
      model: call.model,
      prompt_version: PROMPT_VERSION,
      mode: call.mode,
    });
  } catch (err) {
    const mapped = mapError(err);
    logCall({
      ts: new Date().toISOString(),
      route: "triage",
      api: "chat.completions",
      prompt_version: PROMPT_VERSION,
      model: process.env.LLM_MODEL || "unknown",
      status: mapped.status,
      outcome: mapped.outcome,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
      latency_ms: Date.now() - started,
    });
    return Response.json(
      { error: mapped.message, outcome: mapped.outcome },
      { status: mapped.status },
    );
  }
}
