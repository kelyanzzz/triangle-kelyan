// Prices live in configuration, not in the logic (Activity 5).
// USD per 1,000,000 tokens. Adjust/extend for other models.
const PRICING: Record<string, { input: number; output: number }> = {
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
  "openai/gpt-oss-120b": { input: 0.15, output: 0.75 },
  "openai/gpt-oss-20b": { input: 0.1, output: 0.5 },
};

const DEFAULT_PRICE = { input: 0.59, output: 0.79 };

// Cost ≈ input tokens × input price + output tokens × output price.
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model] ?? DEFAULT_PRICE;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
