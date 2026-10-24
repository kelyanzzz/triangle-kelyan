// F4 — /admin: lists every logged smoke run (accuracy, outcome counts,
// latency, cost, model) and aggregates the per-call log by prompt version,
// API and model. A plain table, no charts library (Activity 5, Step 2).
import { listRunSummaries } from "@/lib/runStore";
import { readCalls } from "@/lib/logStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pct(x: number | null): string {
  return x === null ? "—" : `${(x * 100).toFixed(0)}%`;
}
function usd(x: number): string {
  return `$${x.toFixed(6)}`;
}

type Agg = {
  key: string;
  prompt_version: string;
  api: string;
  model: string;
  calls: number;
  errors: number;
  input: number;
  output: number;
  cost: number;
  statuses: Record<string, number>;
};

export default function AdminPage() {
  const runs = listRunSummaries();
  const calls = readCalls();

  const aggMap = new Map<string, Agg>();
  for (const c of calls) {
    const key = `${c.prompt_version}|${c.api}|${c.model}`;
    let a = aggMap.get(key);
    if (!a) {
      a = {
        key,
        prompt_version: c.prompt_version,
        api: c.api,
        model: c.model,
        calls: 0,
        errors: 0,
        input: 0,
        output: 0,
        cost: 0,
        statuses: {},
      };
      aggMap.set(key, a);
    }
    a.calls++;
    if (c.status >= 400) a.errors++;
    a.input += c.input_tokens;
    a.output += c.output_tokens;
    a.cost += c.cost_usd;
    a.statuses[String(c.status)] = (a.statuses[String(c.status)] ?? 0) + 1;
  }
  const aggs = [...aggMap.values()].sort((a, b) => b.calls - a.calls);

  return (
    <main className="admin">
      <p>
        <a href="/">← Back to the app</a>
      </p>
      <h1>Admin</h1>

      <h2>Smoke runs ({runs.length})</h2>
      {runs.length === 0 ? (
        <p>No runs yet. Run a smoke test from the app.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Model</th>
                <th>Prompt</th>
                <th>Mode</th>
                <th>Dataset</th>
                <th>N</th>
                <th>Cat. acc.</th>
                <th>Prio. acc.</th>
                <th>ok / invalid / error</th>
                <th>Avg latency</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.run_id}>
                  <td>{r.ts.replace("T", " ").slice(0, 19)}</td>
                  <td>{r.model}</td>
                  <td>{r.prompt_version}</td>
                  <td>{r.mode}</td>
                  <td>{r.dataset}</td>
                  <td>{r.sample}</td>
                  <td>{pct(r.category_accuracy)}</td>
                  <td>{pct(r.priority_accuracy)}</td>
                  <td>
                    {r.outcomes.ok} / {r.outcomes.invalid_model_output} /{" "}
                    {r.outcomes.error}
                  </td>
                  <td>{r.avg_latency_ms} ms</td>
                  <td>{usd(r.total_cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Per-call totals ({calls.length} calls)</h2>
      {aggs.length === 0 ? (
        <p>No calls logged yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Prompt</th>
                <th>API</th>
                <th>Model</th>
                <th>Calls</th>
                <th>Errors</th>
                <th>By status</th>
                <th>Input tok</th>
                <th>Output tok</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {aggs.map((a) => (
                <tr key={a.key}>
                  <td>{a.prompt_version}</td>
                  <td>{a.api}</td>
                  <td>{a.model}</td>
                  <td>{a.calls}</td>
                  <td>{a.errors}</td>
                  <td>
                    {Object.entries(a.statuses)
                      .map(([s, n]) => `${s}:${n}`)
                      .join("  ")}
                  </td>
                  <td>{a.input}</td>
                  <td>{a.output}</td>
                  <td>{usd(a.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
