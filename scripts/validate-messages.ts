import { readFileSync } from "node:fs";
import { validateCatalogs, flattenCatalog } from "../i18n/catalog-validation";
import { SUPPORTED_LOCALES, type AppLocale } from "../i18n/locale";

const catalogs = Object.fromEntries(SUPPORTED_LOCALES.map(locale => [locale,
  JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")),
])) as Record<AppLocale, unknown>;
const errors = validateCatalogs(catalogs);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Catalog validation passed: ${flattenCatalog(catalogs["en-US"]).size} keys in each of ${SUPPORTED_LOCALES.join(", ")}.`);
}
