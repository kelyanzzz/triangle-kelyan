// Activity 1 + 2 — chat: one prompt, one answer; the client resends history.
// The server is stateless and only accepts user/assistant turns.
import { chat, type ChatTurn, PROMPT_VERSION } from "@/lib/llm";
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

  if (
    typeof body !== "object" ||
    body === null ||
    !("message" in body) ||
    typeof (body as { message: unknown }).message !== "string" ||
    !(body as { message: string }).message.trim()
  ) {
    return Response.json(
      { error: "Please provide a non-empty message string." },
      { status: 400 },
    );
  }

  // Optional history. Reject any system turn sent from the browser (checkpoint).
  const rawHistory = (body as { history?: unknown }).history;
  const history: ChatTurn[] = [];
  if (Array.isArray(rawHistory)) {
    for (const turn of rawHistory) {
      const role = (turn as { role?: unknown })?.role;
      const content = (turn as { content?: unknown })?.content;
      if (typeof content !== "string") continue;
      if (role === "system") {
        return Response.json(
          { error: "Only user and assistant turns are allowed." },
          { status: 400 },
        );
      }
      if (role === "user" || role === "assistant") {
        history.push({ role, content });
      }
    }
  }

  const message = (body as { message: string }).message;

  try {
    const { answer, usage, model } = await chat(message, history);
    logCall({
      ts: new Date().toISOString(),
      route: "chat",
      api: "chat.completions",
      prompt_version: "chat-v1",
      model,
      status: 200,
      outcome: "ok",
      input_tokens: usage.input,
      output_tokens: usage.output,
      total_tokens: usage.total,
      cost_usd: estimateCostUsd(model, usage.input, usage.output),
      latency_ms: Date.now() - started,
    });
    return Response.json({ answer, usage, model });
  } catch (err) {
    const mapped = mapError(err);
    logCall({
      ts: new Date().toISOString(),
      route: "chat",
      api: "chat.completions",
      prompt_version: "chat-v1",
      model: process.env.LLM_MODEL || "unknown",
      status: mapped.status,
      outcome: mapped.outcome,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
      latency_ms: Date.now() - started,
    });
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
}
