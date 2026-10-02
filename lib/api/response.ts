import { jsonResponse } from "./json-response";
import { WireCompatibilityError } from "@/lib/money/wire";
import { z } from "zod";
import { AuthError } from "./auth-context";
import { PeriodLockedError } from "./period-lock";
import { LimitExceededError } from "./check-limit";
import { MissingExchangeRateError } from "@/lib/currency/converter";
import { CurrencyRolloutError } from "@/lib/currency/rollout";

/** 200 OK response */
export function ok<T>(data: T) {
  return jsonResponse(data);
}

/** 201 Created response */
export function created<T>(data: T) {
  return jsonResponse(data, { status: 201 });
}

/** Error response with status code */
export function error(message: string, status = 500) {
  return jsonResponse({ error: message }, { status });
}

/** 400 Validation error response */
export function validationError(message: string) {
  return jsonResponse({ error: message }, { status: 400 });
}

/** 404 Not found response */
export function notFound(entity = "Resource") {
  return jsonResponse({ error: `${entity} not found` }, { status: 404 });
}

/** Standard error handler for catch blocks */
export function handleError(err: unknown) {
  if (err instanceof WireCompatibilityError) {
    return jsonResponse({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof CurrencyRolloutError) {
    return jsonResponse({ error: err.message }, { status: 403 });
  }
  if (err instanceof AuthError) {
    return jsonResponse({ error: err.message }, { status: err.status });
  }
  if (err instanceof PeriodLockedError) {
    return jsonResponse({ error: err.message }, { status: 422 });
  }
  if (err instanceof LimitExceededError) {
    return jsonResponse({ error: err.message }, { status: 403 });
  }
  if (err instanceof MissingExchangeRateError) {
    return jsonResponse({ error: err.message }, { status: 422 });
  }
  if (err instanceof z.ZodError) {
    const message = err.issues.map((i) => i.message).join(", ");
    return jsonResponse({ error: message }, { status: 400 });
  }
  console.error(err);
  return jsonResponse({ error: "Internal error" }, { status: 500 });
}
