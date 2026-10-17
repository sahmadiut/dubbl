import { z } from "zod";
import { isTimeZone, SUPPORTED_LOCALES } from "./locale";

export const localePreferencesSchema = z.object({
  language: z.enum(SUPPORTED_LOCALES).nullable().optional().describe("UI language en-US or fa-IR; null inherits organization, cookie, header then en-US"),
  timeZone: z.string().refine(isTimeZone, "Use a supported IANA timezone or UTC").nullable().optional().describe("Independent IANA presentation timezone, e.g. Europe/London; null uses UTC"),
  numerals: z.enum(["latn", "arabext"]).nullable().optional().describe("Presentation numerals; null uses the language default"),
  calendar: z.enum(["gregory", "persian"]).nullable().optional().describe("Presentation calendar only; null uses the language default; stored dates stay Gregorian"),
}).strict().refine(value => Object.keys(value).length > 0, "Provide at least one preference");
