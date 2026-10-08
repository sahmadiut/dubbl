import { stringifyWire } from "@/lib/money/wire";

/** Preserve opaque field names/units. Canonical keys make initial/retry HMAC bytes identical after jsonb storage. */
export function webhookBody(payload: unknown): string {
  const parsed: unknown = JSON.parse(stringifyWire(payload));
  function sort(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sort);
    if (value !== null && typeof value === "object") return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, sort(item)]),
    );
    return value;
  }
  return JSON.stringify(sort(parsed));
}
