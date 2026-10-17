import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator, useTranslations } from "next-intl";
import { Linter } from "eslint";
import { validateCatalogs, flattenCatalog, RICH_TEXT_TAGS } from "../i18n/catalog-validation";
import { richTextTags } from "../i18n/rich-text";
import { safeTranslationsRule } from "../scripts/eslint-safe-translations.mjs";
import { PresentationProvider } from "../i18n/provider";
import { resolvePresentation } from "../i18n/locale";
import { LocalePreferences } from "../components/settings/locale-preferences";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const pair = (english: string, persian = english) => ({
  "en-US": { Test: { message: english } }, "fa-IR": { Test: { message: persian } },
});

test("every production catalog key is present, nonempty and has a compatible ICU contract", () => {
  assert.deepEqual(validateCatalogs({ "en-US": en, "fa-IR": fa }), []);
  assert.ok(flattenCatalog(en).size > 0);
  assert.deepEqual(Object.keys(richTextTags).sort(), [...RICH_TEXT_TAGS].sort());
});

test("missing/extra keys and malformed catalog values fail closed", () => {
  assert.match(validateCatalogs({ "en-US": en, "fa-IR": { Test: { extra: "Extra" } } }).join("\n"), /missing key/);
  for (const bad of [null, [], {}, "root", { Test: "" }, { Test: "  " }, { Test: 1 }, { "bad.key": "x" }, JSON.parse('{"__proto__":"x"}')]) {
    assert.ok(validateCatalogs({ "en-US": en, "fa-IR": bad }).length);
  }
});

test("ICU syntax and nested interpolation type/selector/format mismatches are rejected", () => {
  for (const bad of ["Hello {", "{n, plural, one {one}}", "{state, select, draft {draft}}", "<strong>unclosed"]) {
    assert.ok(validateCatalogs(pair("hello", bad)).length, bad);
  }
  for (const [a, b] of [
    ["Hello {name}", "Hello {user}"], ["{n, number}", "{n}"],
    ["{n, number, ::currency/USD}", "{n, number, ::currency/IRR}"],
    ["{state, select, draft {{name}} other {Other}}", "{state, select, draft {Draft} other {Other}}"],
    ["{state, select, draft {Draft} other {Other}}", "{state, select, sent {Sent} other {Other}}"],
    ["<strong>{name}</strong>", "<em>{name}</em>"],
    ["{n, plural, =0 {None} one {One} other {Many}}", "{n, plural, one {One} other {Many}}"],
    ["{n, plural, offset:1 one {One} other {Many}}", "{n, plural, one {One} other {Many}}"],
  ]) assert.match(validateCatalogs(pair(a, b)).join("\n"), /incompatible/, `${a} / ${b}`);
});

test("plural validation follows locale categories recursively, including ordinals", () => {
  assert.deepEqual(validateCatalogs(pair("{n, plural, one {# item} other {# items}}")), []);
  assert.deepEqual(validateCatalogs(pair(
    "{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}",
    "{n, selectordinal, other {#}}",
  )), []);
  for (const bad of [
    "{n, plural, other {#}}", "{n, plural, one {#} two {#} other {#}}",
    "{mode, select, a {{n, plural, other {#}}} other {none}}",
  ]) assert.match(validateCatalogs(pair(bad)).join("\n"), /plural branch/);
});

test("valid ICU escaping, reordered placeholders and nested selects stay compatible", () => {
  assert.deepEqual(validateCatalogs(pair(
    "'{literal}' {state, select, draft {<strong>{name}</strong>: {n, plural, one {# item} other {# items}}} other {{name}}}",
    "{state, select, other {{name}} draft {{n, plural, one {# item} other {# items}}: <strong>{name}</strong>}} '{literal}'",
  )), []);
});

test("Persian 0/1/2 and fractional/ordinal branches use runtime ICU, not English assumptions", () => {
  assert.deepEqual([0, 1, 2, 0.5, 1.5].map(n => new Intl.PluralRules("fa-IR").select(n)), ["one", "one", "other", "one", "other"]);
  for (const locale of ["en-US", "fa-IR"] as const) {
    const t = createTranslator({ locale, messages: {
      cardinal: "{n, plural, one {one:#} other {other:#}}",
      ordinal: locale === "en-US" ? "{n, selectordinal, one {one} two {two} few {few} other {other}}" : "{n, selectordinal, other {other}}",
      exact: "{n, plural, =0 {empty} one {one} other {other}}",
    }, onError: error => { throw error; } });
    assert.deepEqual([0, 1, 2].map(n => t("cardinal", { n }).split(":")[0]), locale === "fa-IR" ? ["one", "one", "other"] : ["other", "one", "other"]);
    assert.deepEqual([0, 1, 2].map(n => t("ordinal", { n })), locale === "fa-IR" ? ["other", "other", "other"] : ["other", "one", "two"]);
    assert.equal(t("exact", { n: 0 }), "empty");
  }
});

test("translated HTML, attributes and unapproved structural tags are rejected", () => {
  for (const bad of ["<script>alert(1)</script>", '<strong onclick="x">text</strong>', "<a>link</a>", "'<img src=x onerror=alert(1)>'", "<img/>", "<!-- comment -->"]) {
    assert.ok(validateCatalogs(pair(bad)).length, bad);
  }
  assert.deepEqual(validateCatalogs(pair("<strong>{name}</strong> <em>emphasis</em> <code>code</code>")), []);
});

test("React rich and plain translations escape adversarial interpolation in both locales", () => {
  const name = '<img src=x onerror="alert(1)"> & <script>x</script>';
  for (const locale of ["en-US", "fa-IR"]) {
    const t = createTranslator({ locale, messages: { plain: "Hello {name}", rich: "<strong>{name}</strong> <em>text</em> <code>{name}</code>" }, onError: error => { throw error; } });
    const plain = renderToStaticMarkup(createElement("p", null, t("plain", { name })));
    const rich = renderToStaticMarkup(createElement("p", null, t.rich("rich", { ...richTextTags, name })));
    for (const html of [plain, rich]) {
      assert.ok(html.includes("&lt;img"));
      assert.ok(!html.includes("<img"));
      assert.ok(!html.includes("<script"));
    }
    assert.ok(rich.includes("<strong>&lt;img"));
    assert.ok(rich.includes("<em>text</em>"));
    assert.throws(() => Reflect.apply(t, null, ["plain", {}]), /name/);
  }
});

test("locale preference options render from both catalogs while preserving machine values", () => {
  for (const language of ["en-US", "fa-IR"] as const) {
    const messages = language === "en-US" ? en : fa;
    const html = renderToStaticMarkup(createElement(PresentationProvider, {
      presentation: resolvePresentation({ user: { language } }), messages, now: new Date("2026-10-17T00:00:00Z"),
    }, createElement(LocalePreferences)));
    for (const value of ["en-US", "fa-IR", "latn", "arabext", "gregory", "persian"]) assert.ok(html.includes(`value="${value}"`));
    for (const key of ["english", "persian", "latinNumerals", "persianNumerals", "gregorianCalendar", "persianCalendar"] as const) {
      assert.ok(html.includes(messages.LocalePreferences[key]));
    }
    assert.ok(html.includes('placeholder="UTC"'));
  }
  assert.equal(en.LocalePreferences.persianCalendar, "Persian / هجری شمسی");
  assert.equal(en.LocalePreferences.persianNumerals, "۰۱۲۳۴۵۶۷۸۹");
  assert.equal(fa.LocalePreferences.gregorianCalendar, "میلادی");
});

test("lint guards forbid raw/markup/catalog bypasses and HTML sinks in translation modules", () => {
  const linter = new Linter();
  function check(code: string, allowCatalogAccess = false) {
    return linter.verify(code, [{ languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { i18n: { rules: { safe: safeTranslationsRule } } }, rules: { "i18n/safe": ["error", { allowCatalogAccess }] },
    }]);
  }
  for (const code of [
    't.raw("x")', 't["markup"]("x")', 'const {raw} = t;',
    '<p dangerouslySetInnerHTML={{__html: t("x")}} />',
  ]) assert.ok(check(`import {useTranslations as useT} from "next-intl"; const t = useT("Test"); ${code}`).length);
  assert.ok(check('import {useMessages as rawMessages} from "next-intl";').length);
  assert.ok(check('import messages from "../messages/en-US.json"; const x = <p dangerouslySetInnerHTML={{__html: messages.title}}/>;').length);
  assert.ok(check('import {getMessages} from "next-intl/server";').length);
  assert.deepEqual(check('import {getMessages} from "next-intl/server";', true), []);
  assert.ok(check('import {getMessages} from "next-intl/server"; const x = <p dangerouslySetInnerHTML={{__html: "x"}}/>;', true).length);
  assert.deepEqual(check('import {useTranslations} from "next-intl"; const t = useTranslations("Test"); t.rich("x", tags);'), []);
});

// Compiled by the normal typecheck: a removed augmentation makes these expected
// errors fail. Do not invoke a React hook outside a component at runtime.
export function CatalogTypeProbe() {
  const t = useTranslations("LocalePreferences");
  t("title");
  // @ts-expect-error Unknown production message keys must fail compilation.
  t("missingProductionKey");
  // @ts-expect-error Unknown namespaces must fail compilation.
  useTranslations("MissingNamespace");
  return null;
}
