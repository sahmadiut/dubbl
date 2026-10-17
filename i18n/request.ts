import { getRequestConfig } from "next-intl/server";
import { getPresentation } from "./server";

export default getRequestConfig(async () => {
  const { locale, timeZone } = await getPresentation();
  return { locale, timeZone, now: new Date(),
    messages: (await import(`../messages/${locale}.json`)).default };
});
