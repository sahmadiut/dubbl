import { createElement, type ReactNode } from "react";
import { createRequire } from "node:module";
import { renderToStaticMarkup as renderMarkup } from "react-dom/server";
import { PresentationProvider } from "../../i18n/provider";
import { resolvePresentation } from "../../i18n/locale";
import en from "../../messages/en-US.json";
import fa from "../../messages/fa-IR.json";

// Existing production-template fixtures transpile to CommonJS and require real
// child controls. tsx loads our local provider with distinct ESM/CJS identities;
// supply the same presentation to both contexts, as the bundled app does once.
const require = createRequire(import.meta.url);
const CommonJsProvider = (require("../../i18n/provider") as typeof import("../../i18n/provider")).PresentationProvider;

export function renderWithPresentation(node: ReactNode, language: "en-US" | "fa-IR" = "en-US") {
  const props = {
    presentation: resolvePresentation({ user: { language } }),
    messages: language === "en-US" ? en : fa,
    now: new Date("2026-10-17T00:00:00Z"),
  };
  return renderMarkup(createElement(PresentationProvider, props, createElement(CommonJsProvider, props, node)));
}

// Preserve existing financial component assertions with the same root context
// the application supplies now that shared date/dialog primitives use catalogs.
export const renderToStaticMarkup = renderWithPresentation;
