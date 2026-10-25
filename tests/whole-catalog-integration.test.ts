import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator, useTranslations } from "next-intl";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { flattenCatalog, validateCatalogs } from "../i18n/catalog-validation";
import { richTextTags } from "../i18n/rich-text";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

type Values = Record<string, string | number | Date>;
const caller = '<script>Caller & "\u06a9\u0627\u0631\u0628\u0631"</script>';
const escaped = (value: string) => renderToStaticMarkup(h("span", null, value)).slice(6, -7);

function fixtures(nodes: MessageFormatElement[]) {
  const base: Values = {};
  const choices: Values[] = [];
  function visit(elements: MessageFormatElement[], selectorDepth = 0) {
    for (const node of elements) {
      if (node.type === TYPE.tag) visit(node.children, selectorDepth);
      else if (node.type === TYPE.select || node.type === TYPE.plural) {
        assert.equal(selectorDepth, 0, "Add combined fixtures before introducing nested production selectors");
        base[node.value] = node.type === TYPE.select ? "other" : 2;
        if (node.type === TYPE.select) {
          for (const selector of Object.keys(node.options)) choices.push({ [node.value]: selector });
        } else {
          for (const n of [0, 1, 2, 0.5, 1.5, ...Object.keys(node.options).filter(s => s.startsWith("=")).map(s => Number(s.slice(1)))]) choices.push({ [node.value]: n });
        }
        for (const option of Object.values(node.options)) visit(option.value, selectorDepth + 1);
      } else if (node.type === TYPE.number) base[node.value] = 1234.5;
      else if (node.type === TYPE.date || node.type === TYPE.time) base[node.value] = new Date("2026-10-24T12:00:00Z");
      else if (node.type === TYPE.argument && !(node.value in base)) base[node.value] = caller;
    }
  }
  visit(nodes);
  return [base, ...choices.map(choice => ({ ...base, ...choice }))];
}

test("LOC-002 executes every actual catalog leaf with real ICU, rich tags and adversarial caller text", () => {
  assert.deepEqual(validateCatalogs({ "en-US": en, "fa-IR": fa }), []);
  const keys = [...flattenCatalog(en).keys()].sort();
  // Since the last whole-catalog acceptance: AccountNames +101,
  // OnboardingOptions +7, Loans +6, Accounts +1 and RTL accessibility controls +18.
  // Every leaf below still
  // executes against real ICU/rich text rather than only checking this count.
  assert.equal(keys.length, 10723, "Reconcile newly added or removed production keys with whole-catalog ownership");
  assert.deepEqual([...flattenCatalog(fa).keys()].sort(), keys);
  for (const locale of ["fa-IR", "en-US", "fa-IR"] as const) {
    const messages = locale === "fa-IR" ? fa : en;
    const t = createTranslator({ locale, messages, timeZone: "UTC", now: new Date("2026-10-24T00:00:00Z"), onError: error => { throw error; } });
    for (const [key, message] of flattenCatalog(messages)) {
      for (const values of fixtures(parse(message))) {
        // Reflection is confined to this exhaustive runtime probe: production
        // callers remain checked against the real augmented next-intl schema.
        const output = Reflect.apply(t.rich, t, [key, { ...richTextTags, ...values }]) as ReactNode;
        const html = renderToStaticMarkup(h("span", null, output));
        assert.ok(html.length > 13, `${locale}:${key}: empty runtime message`);
        assert.doesNotMatch(html, /<script\b|<img\b|MISSING_MESSAGE|FORMATTING_ERROR/, `${locale}:${key}`);
        if (html.includes("Caller")) assert.ok(html.includes(escaped(caller)), `${locale}:${key}: escaped caller data`);
      }
    }
  }
});

test("the real provider supplies every complete namespace without language state leaking between renders", () => {
  const leaves = flattenCatalog(en);
  function NamespaceProbe({ keys }: { keys: string[] }) {
    const t = useTranslations();
    return h("main", null, ...keys.map(key => h("p", { key, "data-catalog-key": key },
      Reflect.apply(t.rich, t, [key, { ...richTextTags, ...fixtures(parse(leaves.get(key)!))[0] }]) as ReactNode)));
  }
  const keys = Object.keys(en).map(ns => [...leaves.keys()].find(key => key.startsWith(`${ns}.`))!);
  assert.ok(keys.every(Boolean));
  const diagnostics: unknown[][] = [], previous = console.error;
  console.error = (...args: unknown[]) => { diagnostics.push(args); };
  try {
    const first = renderWithPresentation(h(NamespaceProbe, { keys }), "fa-IR");
    const english = renderWithPresentation(h(NamespaceProbe, { keys }), "en-US");
    assert.equal(renderWithPresentation(h(NamespaceProbe, { keys }), "fa-IR"), first);
    assert.notEqual(first, english);
    for (const html of [first, english]) {
      assert.equal((html.match(/data-catalog-key=/g) ?? []).length, Object.keys(en).length);
      assert.doesNotMatch(html, /MISSING_MESSAGE|FORMATTING_ERROR|<script\b/);
    }
    assert.deepEqual(diagnostics, []);
  } finally { console.error = previous; }
});

test("every production plural selects its own locale's 0/1/2 branch, including explicit cases and offsets", () => {
  const counts = { "en-US": 0, "fa-IR": 0 };
  for (const locale of ["en-US", "fa-IR"] as const) {
    for (const [key, message] of flattenCatalog(locale === "fa-IR" ? fa : en)) {
      const ast = parse(message);
      // Production plurals currently have literal/argument/pound/tag bodies.
      // Pin that fact so a nested selector requires intentional new coverage.
      for (const node of ast) if (node.type === TYPE.plural) {
        counts[locale]++;
        const offset = node.offset;
        const t = createTranslator({ locale, messages: { message }, onError: error => { throw error; } });
        for (const n of [0, 1, 2, 0.5, 1.5]) {
          const rule = new Intl.PluralRules(locale, { type: node.pluralType }).select(n - node.offset);
          const selected = node.options[`=${n}`] ?? node.options[rule] ?? node.options.other;
          const values = { ...fixtures(ast)[0], [node.value]: n };
          const html = renderToStaticMarkup(h("span", null, t.rich("message", { ...richTextTags, ...values })));
          function check(elements: MessageFormatElement[]) {
            for (const element of elements) {
              if (element.type === TYPE.literal && element.value.trim()) assert.ok(html.includes(escaped(element.value)), `${locale}:${key}:${n}: ${rule}`);
              else if (element.type === TYPE.pound) assert.ok(html.includes(new Intl.NumberFormat(locale).format(n - offset)), `${locale}:${key}:${n}: localized #`);
              else if (element.type === TYPE.tag) check(element.children);
              else assert.ok(element.type !== TYPE.plural && element.type !== TYPE.select, `${key}: add nested selector coverage`);
            }
          }
          check(selected.value);
        }
      }
    }
  }
  assert.equal(counts["en-US"], 160, "Reconcile added or removed production plurals with runtime coverage");
  assert.equal(counts["en-US"], counts["fa-IR"]);
  assert.deepEqual([0, 1, 2].map(n => new Intl.PluralRules("fa-IR").select(n)), ["one", "one", "other"]);
});
