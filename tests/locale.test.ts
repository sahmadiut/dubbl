import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useFormatter, useLocale, useTimeZone, useTranslations } from "next-intl";
import { FONT_FAMILIES, isAppLocale, isTimeZone, negotiateLocale, resolvePresentation, type Presentation } from "../i18n/locale";
import { localePreferencesSchema } from "../i18n/preferences-schema";
import { PresentationProvider, usePresentation } from "../i18n/provider";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";
import { authConfig } from "../lib/auth.config";
import { authDestination } from "../i18n/navigation";
import { hasOrganizationCookie, setActiveOrganization } from "../i18n/organization-client";

test("locale precedence skips invalid preferences at each level", () => {
  const input = { user: { language: "fa-IR" }, organizationLanguage: "en-US", cookie: "fa-IR", acceptLanguage: "en-US" };
  assert.equal(resolvePresentation(input).locale, "fa-IR");
  assert.equal(resolvePresentation({ ...input, user: { language: null } }).locale, "en-US");
  assert.equal(resolvePresentation({ ...input, user: { language: "fa" }, organizationLanguage: "xx" }).locale, "fa-IR");
  assert.equal(resolvePresentation({ user: { language: "../../fa-IR" }, organizationLanguage: "fa-ir", cookie: "no", acceptLanguage: "fa;q=0.9,en;q=0.7" }).locale, "fa-IR");
  assert.equal(resolvePresentation({ acceptLanguage: "de-DE" }).locale, "en-US");
  assert.equal(resolvePresentation({}).locale, "en-US");
  for (const value of [null, undefined, {}, 1, "fa", "en", "en-GB", "fa-ir", "en-US-u-nu-arabext"]) assert.equal(isAppLocale(value), false);
});

test("Accept-Language respects weights, exclusions, malformed ranges and stable ties", () => {
  for (const [header, expected] of [
    ["en;q=0.2, fa-IR;q=0.8", "fa-IR"], ["fa;q=0, en-US;q=1", "en-US"],
    ["de-DE,fa;q=0.5", "fa-IR"], ["FA-ir, en-US", "fa-IR"], ["fa;q=no,en;q=0.3", "en-US"],
    ["en-GB", "en-US"], ["fa-AF", "fa-IR"], ["fa;q=1.1", undefined], ["fa;q=-1", undefined],
    ["fa;q=0.1234", undefined], ["*", undefined], ["fa;foo=bar", undefined], ["fa;q=0", undefined],
    ["en;q=0.5,fa;q=0.5", "en-US"],
  ] as const) assert.equal(negotiateLocale(header), expected, header);
});

test("presentation fields stay independent; invalid saved fields have deterministic fallbacks", () => {
  assert.deepEqual(resolvePresentation({ user: { language: "fa-IR", timeZone: "America/New_York", numerals: "latn", calendar: "gregory" } }),
    { locale: "fa-IR", timeZone: "America/New_York", numerals: "latn", calendar: "gregory", fontFamily: "vazirmatn" });
  assert.deepEqual(resolvePresentation({ user: { language: "en-US", timeZone: "Asia/Tokyo", numerals: "arabext", calendar: "persian" } }),
    { locale: "en-US", timeZone: "Asia/Tokyo", numerals: "arabext", calendar: "persian", fontFamily: "vazirmatn" });
  assert.deepEqual(resolvePresentation({ user: { language: "fa-IR", timeZone: "invalid", numerals: "invalid", calendar: "invalid" } }),
    { locale: "fa-IR", timeZone: "UTC", numerals: "arabext", calendar: "persian", fontFamily: "vazirmatn" });
  for (const value of ["Tehran", "", "Not/AZone", "+03:30", null]) assert.equal(isTimeZone(value), false);
  for (const value of ["UTC", "Europe/London", "Asia/Tehran", "Etc/GMT+5"]) assert.equal(isTimeZone(value), true);
});

test("font overrides validate independently, null clears and malformed saved values fall back", () => {
  for (const fontFamily of FONT_FAMILIES) {
    assert.deepEqual(localePreferencesSchema.parse({ fontFamily }), { fontFamily });
    const presentation = resolvePresentation({ user: { language: "fa-IR", fontFamily } });
    assert.equal(presentation.fontFamily, fontFamily);
    assert.equal(presentation.locale, "fa-IR");
  }
  assert.deepEqual(localePreferencesSchema.parse({ fontFamily: null }), { fontFamily: null });
  for (const fontFamily of ["", "unknown", "../abar", "font-abar", {}, 1]) {
    assert.equal(localePreferencesSchema.safeParse({ fontFamily }).success, false);
    assert.equal(resolvePresentation({ user: { fontFamily } }).fontFamily, "vazirmatn");
  }
  assert.equal(resolvePresentation({ user: { fontFamily: null } }).fontFamily, "vazirmatn");
});

test("preference writes are strict partial updates and null clears overrides", () => {
  assert.deepEqual(localePreferencesSchema.parse({ language: null }), { language: null });
  assert.deepEqual(localePreferencesSchema.parse({ timeZone: "Europe/London", calendar: "persian" }), { timeZone: "Europe/London", calendar: "persian" });
  for (const value of [{}, null, { language: "fa" }, { language: "fa-ir" }, { userId: "foreign" }, { timeZone: "invalid" },
    { language: "fa-IR", currency: "IRR" }, { numerals: "arab" }, { calendar: "islamic" }]) {
    assert.equal(localePreferencesSchema.safeParse(value).success, false);
  }
});

function Probe() {
  const formatter = useFormatter(), t = useTranslations("LocalePreferences"), presentation = usePresentation();
  return createElement("output", null, JSON.stringify({ locale: useLocale(), timeZone: useTimeZone(), presentation,
    date: formatter.dateTime(new Date("2026-10-17T01:30:00Z"), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }),
    title: t("title") }));
}

test("server-resolved provider payload survives serialization with identical client rendering", () => {
  for (const language of ["en-US", "fa-IR"]) for (const timeZone of [null, "America/Los_Angeles", "Asia/Tokyo"]) {
    const presentation = resolvePresentation({ user: { language, timeZone } });
    const messages = language === "en-US" ? en : fa, now = new Date("2026-10-17T00:00:00Z");
    const server = renderToString(createElement(PresentationProvider, { presentation, messages, now }, createElement(Probe)));
    const wire = JSON.parse(JSON.stringify({ presentation, messages, now })) as { presentation: Presentation; messages: typeof en; now: string };
    const client = renderToString(createElement(PresentationProvider, { ...wire, now: new Date(wire.now) }, createElement(Probe)));
    assert.equal(client, server);
    assert.ok(server.includes(timeZone ?? "UTC"));
    assert.ok(server.includes(language));
    assert.deepEqual(Object.keys(messages.LocalePreferences).sort(), Object.keys(en.LocalePreferences).sort());
  }
});

test("locale foundation preserves existing authentication URL behavior", async () => {
  const redirect = authConfig.callbacks!.redirect!;
  for (const url of ["/invoices?status=draft", "/settings", "/portal/token", "/pay/token"]) {
    assert.equal(await redirect({ url, baseUrl: "https://fixture.test" }), `https://fixture.test${url}`);
  }
  assert.equal(await redirect({ url: "/", baseUrl: "https://fixture.test" }), "https://fixture.test/dashboard");
  assert.equal(authConfig.pages?.signIn, "/sign-in");
  assert.equal(authConfig.pages?.newUser, "/onboarding");
  for (const url of ["/invoices?status=draft#items", "https://fixture.test/settings?tab=general"]) {
    assert.equal(authDestination(url, "https://fixture.test"), new URL(url, "https://fixture.test").href);
  }
  for (const url of ["https://foreign.test/", "//foreign.test/invoices", "javascript:alert(1)", "http://["]) {
    assert.equal(authDestination(url, "https://fixture.test"), "https://fixture.test/dashboard");
  }
});

test("organization selection mirrors browser storage to a scoped cookie and clears both", () => {
  const original = new Map(["localStorage", "document", "location"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map<string, string>();
  let cookie = "", written = "";
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key),
  } });
  Object.defineProperty(globalThis, "location", { configurable: true, value: { protocol: "https:" } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    get cookie() { return cookie; }, set cookie(value: string) { written = value; cookie = value.split(";")[0]; },
  } });
  try {
    setActiveOrganization("a");
    assert.equal(values.get("activeOrgId"), "a");
    assert.equal(hasOrganizationCookie("a"), true);
    assert.equal(hasOrganizationCookie("b"), false);
    assert.match(written, /Path=\/; SameSite=Lax; Max-Age=31536000; Secure$/);
    setActiveOrganization("b");
    assert.equal(hasOrganizationCookie("a"), false);
    assert.equal(hasOrganizationCookie("b"), true);
    setActiveOrganization(null);
    assert.equal(values.has("activeOrgId"), false);
    assert.equal(hasOrganizationCookie("b"), false);
    assert.match(written, /Max-Age=0/);
  } finally {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
