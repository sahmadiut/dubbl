import { docs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";
import { defineI18n } from "fumadocs-core/i18n";

export const i18n = defineI18n({
  defaultLanguage: "en",
  languages: ["en", "fa"],
  hideLocale: "always",
});

export const source = loader({
  baseUrl: "/docs",
  i18n,
  source: docs.toFumadocsSource(),
});
