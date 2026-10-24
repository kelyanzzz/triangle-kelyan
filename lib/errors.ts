// Maps any failure to one HTTP status and one safe message (Activity 4 table).
// No stack trace or provider detail reaches the browser (Activity 7).
import { LlmConfigError, LlmInvalidOutputError } from "./llm";

export type MappedError = { status: number; outcome: string; message: string };

export function mapError(err: unknown): MappedError {
  // Invalid JSON or schema mismatch from the model.
  if (err instanceof LlmInvalidOutputError) {
    return {
      status: 502,
      outcome: "invalid_model_output",
      message: "The model returned an invalid result. Please try again.",
    };
  }

  // Our own misconfiguration (missing key/url) — never a provider call.
  if (err instanceof LlmConfigError) {
    return {
      status: 500,
      outcome: "internal_error",
      message: "The triage service is not configured correctly.",
    };
  }

  const status = (err as { status?: number })?.status;
  const code = (err as { code?: string })?.code;

  // Timeout
  if (code === "ETIMEDOUT" || (err as { name?: string })?.name === "APITimeoutError") {
    return {
      status: 504,
      outcome: "triage_timeout",
      message: "The triage request timed out. Please try again.",
    };
  }

  if (status === 429) {
    return {
      status: 429,
      outcome: "rate_limited",
      message: "The model provider is rate-limiting requests. Please retry shortly.",
    };
  }

  // Wrong key, model or parameter — our fault, do not retry.
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return {
      status: 500,
      outcome: "internal_error",
      message: "The triage service could not process the request.",
    };
  }

  // Provider 5xx or network error.
  if ((status && status >= 500) || code === "ECONNRESET" || code === "ENOTFOUND") {
    return {
      status: 502,
      outcome: "triage_unavailable",
      message: "The model provider is unavailable. Please try again later.",
    };
  }

  return {
    status: 500,
    outcome: "internal_error",
    message: "Unexpected error. Please try again.",
  };
}
