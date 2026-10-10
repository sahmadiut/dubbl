import { WireCompatibilityError, stringifyWire } from "@/lib/money/wire";

function decimalKey(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value)!;
  const digits = (match[2] + (match[3] ?? "")).replace(/^0+/, "");
  if (!digits) return "0";
  const significant = digits.replace(/0+$/, "");
  const exponent = BigInt(match[4] ?? "0") - BigInt((match[3] ?? "").length) + BigInt(digits.length - significant.length);
  return `${match[1]}${significant}e${exponent}`;
}

/** Read jsonb as SQL text before pg can round numeric tokens. Strings remain opaque. */
export function parseOpaqueJson(source: string | null): unknown {
  if (source === null) return null;
  for (const match of source.matchAll(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)) {
    const token = match[0];
    if (token.startsWith('"')) continue;
    const numeric = Number(token);
    if (!Number.isFinite(numeric) || Math.abs(numeric) > Number.MAX_SAFE_INTEGER
      || decimalKey(token) !== decimalKey(String(numeric))) {
      throw new WireCompatibilityError("Opaque JSON number cannot round-trip; preserve exact values as strings");
    }
  }
  return JSON.parse(source);
}

/** Preflight before a JSON column write, retaining units and safe legacy numbers. */
export function opaqueJsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(stringifyWire(value)) as Record<string, unknown>;
}
