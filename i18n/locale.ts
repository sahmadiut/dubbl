export const SUPPORTED_LOCALES = ["en-US", "fa-IR"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_COOKIE = "DUBBL_LOCALE";
export const ORGANIZATION_COOKIE = "DUBBL_ORGANIZATION";

export function isAppLocale(value: unknown): value is AppLocale {
  return value === "en-US" || value === "fa-IR";
}

// Persisted preferences are exact allowlisted tags. Only HTTP negotiation accepts
// language-only tags and other regional variants of the supported languages.
export function negotiateLocale(header?: string | null): AppLocale | undefined {
  const ranges = (header ?? "").slice(0, 8192).split(",").map((part, order) => {
    const [tag, ...parameters] = part.trim().split(";");
    const quality = parameters.length === 0 ? "1" : parameters.length === 1
      ? /^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i.exec(parameters[0].trim())?.[1] : undefined;
    return { tag: tag.toLowerCase(), quality: quality === undefined ? 0 : Number(quality), order };
  }).filter(range => range.quality > 0).sort((a, b) => b.quality - a.quality || a.order - b.order);
  for (const { tag } of ranges) {
    if (tag === "en" || /^en-[a-z]{2}$/i.test(tag)) return "en-US";
    if (tag === "fa" || /^fa-[a-z]{2}$/i.test(tag)) return "fa-IR";
  }
}

export type PresentationPreferences = {
  language?: unknown;
  timeZone?: unknown;
  numerals?: unknown;
  calendar?: unknown;
};

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100 || !/^(?:UTC|[A-Za-z_]+\/[A-Za-z_+\-/0-9]+)$/.test(value)) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
}

export function resolvePresentation(input: {
  user?: PresentationPreferences | null;
  organizationLanguage?: unknown;
  cookie?: unknown;
  acceptLanguage?: string | null;
}) {
  const locale = [input.user?.language, input.organizationLanguage, input.cookie].find(isAppLocale)
    ?? negotiateLocale(input.acceptLanguage) ?? "en-US";
  return {
    locale,
    // UTC is a deterministic fallback, independent of language and server TZ.
    timeZone: isTimeZone(input.user?.timeZone) ? input.user.timeZone : "UTC",
    numerals: input.user?.numerals === "latn" || input.user?.numerals === "arabext"
      ? input.user.numerals : locale === "fa-IR" ? "arabext" : "latn",
    calendar: input.user?.calendar === "gregory" || input.user?.calendar === "persian"
      ? input.user.calendar : locale === "fa-IR" ? "persian" : "gregory",
  } as const;
}
export type Presentation = ReturnType<typeof resolvePresentation>;
