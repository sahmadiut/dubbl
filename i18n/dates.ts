import type { Presentation } from "./locale";

// Date-only values are Gregorian calendar coordinates, never local instants.
// Use UTC as the carrier for DayPicker and Intl so neither host nor user TZ
// can move an invoice/due date to an adjacent day.
export function dateOnlyToDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return undefined;
  return date;
}

export function dateToDateOnly(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date-only selection");
  const value = date.toISOString().slice(0, 10);
  if (!dateOnlyToDate(value)) throw new RangeError("Date-only selection must have a four-digit Gregorian year");
  return value;
}

type DateOptions = Pick<Intl.DateTimeFormatOptions, "year" | "month" | "day" | "weekday">;
const defaultDateOptions: DateOptions = { year: "numeric", month: "short", day: "numeric" };

export function formatDateOnly(value: string, presentation: Presentation, options: DateOptions = defaultDateOptions): string {
  const date = dateOnlyToDate(value);
  if (!date) throw new RangeError("Expected an ISO Gregorian date-only value");
  return new Intl.DateTimeFormat(presentation.locale, {
    ...options, calendar: presentation.calendar, numberingSystem: presentation.numerals, timeZone: "UTC",
  }).format(date);
}

// Instants use the independent timezone preference. Formatting never changes
// the Date or its canonical UTC serialization.
export function formatInstant(value: Date, presentation: Presentation, options: Intl.DateTimeFormatOptions = defaultDateOptions): string {
  return new Intl.DateTimeFormat(presentation.locale, {
    ...options, calendar: presentation.calendar, numberingSystem: presentation.numerals, timeZone: presentation.timeZone,
  }).format(value);
}
