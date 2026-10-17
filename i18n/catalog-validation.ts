import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { SUPPORTED_LOCALES, type AppLocale } from "./locale";

// Build/test tooling only. Do not import the parser into application bundles.
export const RICH_TEXT_TAGS = ["strong", "em", "code"] as const;

export function flattenCatalog(catalog: unknown): Map<string, string> {
  const result = new Map<string, string>();
  function visit(value: unknown, path: string) {
    if (typeof value === "string" && path) {
      if (!value.trim()) throw new Error(`${path}: empty message`);
      result.set(path, value);
      return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) {
      throw new Error(`${path || "catalog"}: expected nonempty object or message`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key) || ["__proto__", "constructor", "prototype"].includes(key)) {
        throw new Error(`${path}: invalid key ${key}`);
      }
      visit(child, path ? `${path}.${key}` : key);
    }
  }
  visit(catalog, "");
  return result;
}

function messageContract(message: string, locale: AppLocale): string {
  const contracts = new Set<string>();
  function visit(elements: MessageFormatElement[]) {
    for (const node of elements) {
      if (node.type === TYPE.literal) {
        // Includes ICU-quoted HTML, which the parser otherwise treats as text.
        if (/<\/?[A-Za-z!]/.test(node.value)) throw new Error("literal HTML is forbidden");
      } else if (node.type === TYPE.tag) {
        if (!(RICH_TEXT_TAGS as readonly string[]).includes(node.value)) throw new Error(`unapproved rich tag ${node.value}`);
        contracts.add(`tag:${node.value}`);
        visit(node.children);
      } else if (node.type === TYPE.select || node.type === TYPE.plural) {
        const selectors = Object.keys(node.options).sort();
        if (node.type === TYPE.plural) {
          const categories = new Intl.PluralRules(locale, { type: node.pluralType }).resolvedOptions().pluralCategories;
          for (const category of categories) {
            if (!selectors.includes(category)) throw new Error(`missing ${node.pluralType} plural branch ${category}`);
          }
          for (const selector of selectors) {
            if (!/^=\d+$/.test(selector) && !categories.includes(selector as Intl.LDMLPluralRule)) {
              throw new Error(`invalid ${node.pluralType} plural branch ${selector}`);
            }
          }
          // Category sets legitimately vary by locale. Exact cases and offsets do not.
          contracts.add(`${node.value}:plural:${node.pluralType}:${node.offset}:${selectors.filter(s => s.startsWith("=")).join(",")}`);
        } else {
          contracts.add(`${node.value}:select:${selectors.join(",")}`);
        }
        for (const option of Object.values(node.options)) visit(option.value);
      } else if (node.type !== TYPE.pound) {
        // Include number/date styles: translations must not silently alter units or precision.
        const style = "style" in node ? node.style : undefined;
        contracts.add(`${node.value}:${node.type}:${typeof style === "object" && style ? JSON.stringify(style.parsedOptions) : style ?? ""}`);
      }
    }
  }
  visit(parse(message, { requiresOtherClause: true }));
  return [...contracts].sort().join("|");
}

export function validateCatalogs(catalogs: Record<AppLocale, unknown>): string[] {
  const errors: string[] = [];
  const parsed = new Map<AppLocale, Map<string, string>>();
  for (const locale of SUPPORTED_LOCALES) {
    try { parsed.set(locale, flattenCatalog(catalogs[locale])); }
    catch (error) { errors.push(`${locale}: ${(error as Error).message}`); }
  }
  const keys = new Set([...parsed.values()].flatMap(catalog => [...catalog.keys()]));
  for (const key of [...keys].sort()) {
    const contracts = new Map<AppLocale, string>();
    for (const locale of SUPPORTED_LOCALES) {
      const message = parsed.get(locale)?.get(key);
      if (message === undefined) { errors.push(`${locale}:${key}: missing key`); continue; }
      try { contracts.set(locale, messageContract(message, locale)); }
      catch (error) { errors.push(`${locale}:${key}: ${(error as Error).message}`); }
    }
    if (contracts.size === SUPPORTED_LOCALES.length && new Set(contracts.values()).size !== 1) {
      errors.push(`${key}: incompatible interpolation, selector, format or rich-tag contract`);
    }
  }
  return errors;
}
