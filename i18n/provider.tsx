"use client";

import { createContext, useContext } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import type { Presentation } from "./locale";

const PresentationContext = createContext<Presentation | null>(null);
export function PresentationProvider({ presentation, messages, now, children }: {
  presentation: Presentation;
  messages: AbstractIntlMessages;
  now: Date;
  children?: React.ReactNode;
}) {
  return <PresentationContext.Provider value={presentation}>
    <NextIntlClientProvider locale={presentation.locale} timeZone={presentation.timeZone} messages={messages} now={now}>
      {children}
    </NextIntlClientProvider>
  </PresentationContext.Provider>;
}
export function usePresentation() {
  const value = useContext(PresentationContext);
  if (!value) throw new Error("PresentationProvider is required");
  return value;
}
