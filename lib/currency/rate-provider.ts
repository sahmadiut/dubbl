import { isValidCurrencyCode } from "./iso4217";
import { isoRateDate, parseRateJson, providerDecimal } from "./rate-policy";

export interface RateFeed {
  date: string;
  base: string;
  /** Exact quote units per one base unit, never binary floating point. */
  rates: Record<string, string>;
  provider: string;
  /** Null when the source supplies only an effective date (Frankfurter v1). */
  observedAt: string | null;
  importedAt: string;
}
export interface RateProvider {
  name: string;
  fetchRates(base: string): Promise<RateFeed>;
}
const PROVIDERS = ["exchangerate-api", "frankfurter", "openexchangerates"];
export const MAX_FEED_AGE_DAYS = 7;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid provider object");
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{1,12}$/.test(value)) throw new TypeError("Missing provider timestamp");
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new TypeError("Invalid provider timestamp");
  return new Date(seconds * 1000).toISOString();
}

/** All adapters and injected providers pass through this boundary before caching/writes. */
export function validateRateFeed(feed: RateFeed, now = new Date()): RateFeed {
  if (!PROVIDERS.includes(feed.provider) || !isValidCurrencyCode(feed.base) || feed.base !== feed.base.toUpperCase()) {
    throw new TypeError("Invalid provider identity or base");
  }
  const date = isoRateDate(feed.date), today = now.toISOString().slice(0, 10);
  const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000;
  if (age < 0 || age > MAX_FEED_AGE_DAYS) throw new RangeError("Provider effective date is future or stale");
  if (typeof feed.importedAt !== "string" || !Number.isFinite(Date.parse(feed.importedAt)) ||
      new Date(feed.importedAt).toISOString() !== feed.importedAt || Date.parse(feed.importedAt) > now.getTime() + 300000) {
    throw new TypeError("Invalid import timestamp");
  }
  if (feed.observedAt !== null && (typeof feed.observedAt !== "string" || !Number.isFinite(Date.parse(feed.observedAt)) ||
      new Date(feed.observedAt).toISOString() !== feed.observedAt ||
      feed.observedAt.slice(0, 10) !== date || Date.parse(feed.observedAt) > now.getTime() + 300000)) {
    throw new TypeError("Invalid observation timestamp");
  }
  if (feed.provider !== "frankfurter" && feed.observedAt === null) throw new TypeError("Missing observation timestamp");
  const entries = Object.entries(record(feed.rates));
  if (!entries.length || entries.length > 300) throw new RangeError("Invalid provider rate count");
  const rates: Record<string, string> = Object.create(null);
  for (const [code, value] of entries) {
    // Providers can include metals/crypto and non-ISO codes; never store those.
    if (!isValidCurrencyCode(code) || code !== code.toUpperCase()) continue;
    rates[code] = providerDecimal(value);
  }
  if (!Object.keys(rates).length || (rates[feed.base] !== undefined && rates[feed.base] !== "1")) {
    throw new TypeError("Invalid provider base identity or empty rates");
  }
  return { ...feed, rates };
}

export function decodeRateFeed(provider: string, body: string, requestedBase: string, now = new Date()): RateFeed {
  const data = record(parseRateJson(body));
  if (provider === "exchangerate-api" && data.result !== "success") throw new TypeError("Provider did not report success");
  const base = provider === "exchangerate-api" ? data.base_code : data.base;
  if (typeof base !== "string" || base !== (provider === "openexchangerates" ? "USD" : requestedBase)) {
    throw new TypeError("Provider returned an unexpected base");
  }
  const observedAt = provider === "frankfurter" ? null : timestamp(
    provider === "exchangerate-api" ? data.time_last_update_unix : data.timestamp);
  const date = observedAt ? observedAt.slice(0, 10) : data.date;
  if (typeof date !== "string") throw new TypeError("Missing provider effective date");
  return validateRateFeed({ provider, base, date, observedAt, importedAt: now.toISOString(),
    rates: record(data.rates) as Record<string, string> }, now);
}

type ProviderOptions = { fetcher?: typeof fetch; now?: () => Date; timeoutMs?: number };

/** Fixed HTTPS adapters. Errors never include credential-bearing URLs or payloads. */
export function createRateProvider(name: string, appId?: string, options: ProviderOptions = {}): RateProvider {
  if (!PROVIDERS.includes(name) || (name === "openexchangerates" && !appId)) throw new TypeError("Invalid FX provider configuration");
  return { name, async fetchRates(base) {
    if (!isValidCurrencyCode(base) || base !== base.toUpperCase()) throw new TypeError("Invalid requested base");
    const url = name === "frankfurter" ? `https://api.frankfurter.dev/v1/latest?base=${base}` :
      name === "openexchangerates" ? `https://openexchangerates.org/api/latest.json?app_id=${encodeURIComponent(appId!)}` :
        `https://open.er-api.com/v6/latest/${base}`;
    try {
      const response = await (options.fetcher ?? fetch)(url, {
        headers: { accept: "application/json" }, cache: "no-store", redirect: "error",
        signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
      });
      if (!response.ok || !response.body) throw new Error("Provider HTTP failure");
      const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
      let body = "", bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 256000) throw new Error("Provider response too large");
          body += decoder.decode(chunk.value, { stream: true });
        }
        body += decoder.decode();
      } finally { await reader.cancel(); }
      return decodeRateFeed(name, body, base, (options.now ?? (() => new Date()))());
    } catch {
      throw new Error(`FX provider ${name} unavailable or invalid`);
    }
  } };
}

export function getRateProvider(): RateProvider {
  const appId = process.env.OPENEXCHANGERATES_APP_ID;
  if (appId) return createRateProvider("openexchangerates", appId);
  const name = (process.env.EXCHANGE_RATE_PROVIDER ?? "").toLowerCase();
  if (name && !["frankfurter", "exchangerate-api"].includes(name)) throw new TypeError("Unknown FX provider configuration");
  return createRateProvider(name || "exchangerate-api");
}
