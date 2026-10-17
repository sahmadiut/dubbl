import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup as renderMarkup } from "react-dom/server";
import { PresentationProvider } from "../../i18n/provider";
import { resolvePresentation } from "../../i18n/locale";
import en from "../../messages/en-US.json";
import fa from "../../messages/fa-IR.json";

export function renderWithPresentation(node: ReactNode, language: "en-US" | "fa-IR" = "en-US") {
  return renderMarkup(createElement(PresentationProvider, {
    presentation: resolvePresentation({ user: { language } }),
    messages: language === "en-US" ? en : fa,
    now: new Date("2026-10-17T00:00:00Z"),
  }, node));
}

// Preserve existing financial component assertions with the same root context
// the application supplies now that shared date/dialog primitives use catalogs.
export const renderToStaticMarkup = renderWithPresentation;
