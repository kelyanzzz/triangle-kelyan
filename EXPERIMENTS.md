# Experiments

One row per experiment (Activity 3 / 4 / 6). Try at least one obvious ticket,
one ambiguous, one long, and one injection ticket (`TCK-10087`).

| Date | Prompt version | Provider / model | Ticket id | Observed output | Problem noticed | Change made |
|------|----------------|------------------|-----------|-----------------|-----------------|-------------|
| 2026-10-24 | triage-v2 | groq / llama-3.3-70b-versatile | TCK-10087 | _(fill in after running)_ | injection attempt — did the schema still hold? | — |
| | | | | | | |

## Hostile test (Activity 4)

Run the injection tickets (`TCK-10087` and the other adversarial ones). The
`<ticket>` tags + the Zod CHECK should keep the output a valid triage object;
the injected "new instructions" must not change the category, priority or
format.

## Comparison (Activity 8, optional F5)

Run the same smoke test on two configurations (e.g. two models) and record
three differences (model name, structured-output support, latency, tokens,
error messages).

| Config | Cat. accuracy | Prio. accuracy | Avg latency | Total cost |
|--------|---------------|----------------|-------------|------------|
| llama-3.3-70b-versatile | | | | |
| (second model) | | | | |
