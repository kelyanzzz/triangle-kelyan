# Support Triage App

A support-ticket triage feature built on an LLM, following the C4 lab
(AI Systems Integration & Operations, BCS S5). A support agent pastes a ticket;
the server sends it to an LLM, which returns a **category**, **priority**,
**summary** and **suggested action**. The browser never sees the API key — only
the server talks to the provider.

## Features

- **Chat** (`/`, `POST /api/chat`): a real LLM call; the client resends the
  conversation history (the server is stateless). System turns from the browser
  are rejected with `400`.
- **Triage V2 — F1** (`POST /api/triage`): request and response both follow a
  JSON schema, validated with **Zod**. Over-long tickets are rejected with `400`
  before any provider call. The contract is written once in `lib/schema.ts` and
  used twice: sent to the provider (ASK) and checked on the way back (CHECK).
- **Token usage — F2**: each triage result shows input / output / total tokens
  (and an estimated cost).
- **Smoke test — F3** (`POST /api/smoke`): choose the dataset (100-labelled or
  500) and how many tickets to sample at random. For the labelled set, each
  ticket shows predicted vs labelled category and priority, with a mismatch
  summary. Each run is saved to `runs/`.
- **Logging + admin — F4** (`/admin`): every LLM call is logged one line per
  call to `logs/llm-calls.jsonl` (never the key, never the full ticket). The
  `/admin` page lists every smoke run (accuracy, outcome counts, latency, cost,
  model) and per-call totals by prompt version / API / model.

## Run locally

Requires Node.js 20.9+.

```sh
npm install
cp .env.example .env.local   # then fill in the three LLM_ variables
npm run dev
```

Open http://localhost:3033.

`.env.local` (never committed):

```dotenv
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=your_key_here
LLM_MODEL=llama-3.3-70b-versatile
LLM_STRUCTURED_OUTPUT=json_schema   # or "prompt"
```

## Architecture

- `lib/schema.ts` — the Zod contract (request + response) and the JSON Schema.
- `lib/prompt.ts` — the system prompt and `PROMPT_VERSION` (one place).
- `lib/llm.ts` — the single LLM module. Routes call it; components never do.
- `lib/cost.ts` — prices in configuration, not in the logic.
- `lib/errors.ts` — every failure maps to one status and one safe message.
- `lib/logStore.ts` / `lib/runStore.ts` — per-call log and per-run files.
- `app/api/*` — chat, triage, smoke, runs endpoints.
- `app/admin` — the admin page.

### Error policy (Activity 4)

| Failure | Status | Outcome |
|---------|--------|---------|
| Invalid JSON / schema mismatch | 502 | `invalid_model_output` |
| Provider 429 | 429 | `rate_limited` |
| Provider 5xx / network | 502 | `triage_unavailable` |
| Timeout | 504 | `triage_timeout` |
| Wrong key/model/param (400/401/403/404) | 500 | `internal_error` |

## Quality checklist (Activity 7)

- [x] One LLM module (`lib/llm.ts`); routes only call it, no SDK calls in components.
- [x] Prompts live in one place with a `PROMPT_VERSION`.
- [x] All provider settings come from configuration; nothing hard-coded.
- [x] Every failure maps to one status and one safe message.
- [x] Timeouts and retries set explicitly (`timeout`, `maxRetries` in `lib/llm.ts`).
- [x] No stack trace or provider detail reaches the browser.
- [x] The key is used only on the server (not in the browser Network tab).
- [x] `.env.local` is git-ignored (`git check-ignore -v .env.local`).
- [x] Over-long input is rejected with `400`, not a provider call.
- [x] Logs contain no key and no full ticket text.
- [ ] Injection tickets do not change the category, priority or format _(verify + note in EXPERIMENTS.md)._

## Sample data

`data/` holds the 500 unlabelled tickets and the 100 labelled tickets
(category, priority, needs_human_review, tags).
