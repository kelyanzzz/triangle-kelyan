"use client";

import { useState, type FormEvent } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Usage = { input: number; output: number; total: number };

type TriageResult = {
  category: string;
  priority: string;
  summary: string;
  suggested_action: string;
};

type SmokeItem = {
  ticket_id: string;
  outcome: "ok" | "invalid_model_output" | "error";
  predicted: { category: string; priority: string } | null;
  labelled: { category: string; priority: string } | null;
  category_match: boolean | null;
  priority_match: boolean | null;
  latency_ms: number;
};

type SmokeSummary = {
  dataset: string;
  model: string;
  prompt_version: string;
  mode: string;
  sample: number;
  outcomes: { ok: number; invalid_model_output: number; error: number };
  category_accuracy: number | null;
  priority_accuracy: number | null;
  category_mismatches: number | null;
  priority_mismatches: number | null;
  avg_latency_ms: number;
  total_cost_usd: number;
};

export default function Home() {
  return (
    <main className="page">
      <header className="page-head">
        <h1>Support Triage</h1>
        <a href="/admin" className="admin-link">
          Admin →
        </a>
      </header>
      <TriagePanel />
      <SmokePanel />
      <ChatPanel />
    </main>
  );
}

/* ---------------- Triage (F1 + F2) ---------------- */
function TriagePanel() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [model, setModel] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !subject.trim() || !body.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setUsage(null);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Triage failed.");
      setResult(data.triage);
      setUsage(data.usage);
      setCost(data.cost_usd);
      setModel(data.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Triage failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Triage a ticket</h2>
      <form onSubmit={submit}>
        <label htmlFor="subject">Subject</label>
        <input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Invoice shows the wrong VAT rate"
          disabled={busy}
        />
        <label htmlFor="body">Body</label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste the customer ticket here..."
          rows={5}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !subject.trim() || !body.trim()}>
          {busy ? "Classifying..." : "Triage"}
        </button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <div className="result">
          <div className="badges">
            <span className={`badge cat-${result.category}`}>{result.category}</span>
            <span className={`badge prio-${result.priority}`}>{result.priority}</span>
          </div>
          <p>
            <strong>Summary:</strong> {result.summary}
          </p>
          <p>
            <strong>Suggested action:</strong> {result.suggested_action}
          </p>
          {usage && (
            <p className="usage">
              Tokens — input {usage.input}, output {usage.output}, total {usage.total}
              {cost !== null && <> · cost ${cost.toFixed(6)}</>}
              {model && <> · {model}</>}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------- Smoke test (F3) ---------------- */
function SmokePanel() {
  const [dataset, setDataset] = useState<"labelled100" | "unlabelled500">(
    "labelled100",
  );
  const [sample, setSample] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SmokeSummary | null>(null);
  const [items, setItems] = useState<SmokeItem[]>([]);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    setItems([]);
    try {
      const res = await fetch("/api/smoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset, sample }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Smoke test failed.");
      setSummary(data.summary);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Smoke test failed.");
    } finally {
      setBusy(false);
    }
  }

  const labelled = dataset === "labelled100";

  return (
    <section className="panel">
      <h2>Smoke test</h2>
      <div className="controls">
        <label>
          Dataset
          <select
            value={dataset}
            onChange={(e) => setDataset(e.target.value as typeof dataset)}
            disabled={busy}
          >
            <option value="labelled100">100 labelled</option>
            <option value="unlabelled500">500 unlabelled</option>
          </select>
        </label>
        <label>
          Sample (max 25)
          <input
            type="number"
            min={1}
            max={25}
            value={sample}
            onChange={(e) => setSample(Number(e.target.value))}
            disabled={busy}
          />
        </label>
        <button onClick={run} disabled={busy}>
          {busy ? "Running..." : "Run"}
        </button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {summary && (
        <div className="summary">
          <p>
            <strong>{summary.sample}</strong> tickets · {summary.model} ·{" "}
            {summary.prompt_version} ({summary.mode})
          </p>
          <p>
            Outcomes — ok {summary.outcomes.ok}, invalid{" "}
            {summary.outcomes.invalid_model_output}, error {summary.outcomes.error}
          </p>
          {summary.category_accuracy !== null && (
            <p>
              Category accuracy{" "}
              <strong>{(summary.category_accuracy * 100).toFixed(0)}%</strong> (
              {summary.category_mismatches} mismatched) · Priority accuracy{" "}
              <strong>{(summary.priority_accuracy! * 100).toFixed(0)}%</strong> (
              {summary.priority_mismatches} mismatched)
            </p>
          )}
          <p>
            Avg latency {summary.avg_latency_ms} ms · total cost $
            {summary.total_cost_usd.toFixed(6)}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Predicted cat.</th>
                {labelled && <th>Labelled cat.</th>}
                <th>Predicted prio.</th>
                {labelled && <th>Labelled prio.</th>}
                <th>Outcome</th>
                <th>ms</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.ticket_id}>
                  <td>{it.ticket_id}</td>
                  <td>{it.predicted?.category ?? "—"}</td>
                  {labelled && (
                    <td className={it.category_match === false ? "miss" : ""}>
                      {it.labelled?.category ?? "—"}
                    </td>
                  )}
                  <td>{it.predicted?.priority ?? "—"}</td>
                  {labelled && (
                    <td className={it.priority_match === false ? "miss" : ""}>
                      {it.labelled?.priority ?? "—"}
                    </td>
                  )}
                  <td>{it.outcome}</td>
                  <td>{it.latency_ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------------- Chat (Activity 1 + 2) ---------------- */
function ChatPanel() {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    const message = text;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Message failed.");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: message },
        { role: "assistant", content: data.answer },
      ]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Chat</h2>
      <div className="messages" role="log" aria-live="polite">
        {messages.length === 0 && <p className="muted">No messages yet.</p>}
        {messages.map((m, i) => (
          <div className={`message ${m.role}`} key={i}>
            <strong>{m.role === "user" ? "You" : "Assistant"}</strong>
            <p>{m.content}</p>
          </div>
        ))}
      </div>
      <form onSubmit={send}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask something..."
          rows={2}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !text.trim()}>
          {busy ? "Sending..." : "Send"}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </section>
  );
}
