import { cache } from "react";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadPresentationPreferences } from "@/lib/api/locale-preferences";
import { LOCALE_COOKIE, ORGANIZATION_COOKIE, resolvePresentation } from "./locale";

export const getPresentation = cache(async () => {
  const [store, requestHeaders, session] = await Promise.all([cookies(), headers(), auth()]);
  const preferences = session?.user?.id
    ? await loadPresentationPreferences(session.user.id, store.get(ORGANIZATION_COOKIE)?.value)
    : {};
  return resolvePresentation({ ...preferences,
    cookie: store.get(LOCALE_COOKIE)?.value,
    acceptLanguage: requestHeaders.get("accept-language"),
  });
});
