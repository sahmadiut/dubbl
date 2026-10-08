import { z } from "zod";

export const scheduleIdSchema = z.string().uuid().describe("UUID of a live report schedule in the current organization");
const fields = {
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]).describe("Local calendar frequency; quarterly uses January/April/July/October"),
  format: z.enum(["pdf", "csv", "xlsx"]).default("pdf").describe("Attachment format; monetary cells retain literal integer cents and exact Minor strings"),
  recipients: z.array(z.string().email().max(254).describe("Recipient email address")).min(1).max(100).describe("One to 100 email addresses; all receive the same preflighted attachment"),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional().describe("Weekly local weekday, Sunday=0; null defaults to Monday"),
  dayOfMonth: z.number().int().min(1).max(28).nullable().optional().describe("Monthly/quarterly local day, 1-28; null defaults to 1"),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("08:00").describe("Local HH:MM, 24-hour time; nonexistent DST times are skipped"),
  timezone: z.string().min(1).max(100).refine(value => {
    if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(value)) return false;
    try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
  }, "Unsupported IANA timezone").default("UTC").describe("IANA timezone, defaults to UTC; independent of currency and locale"),
};
export const createReportScheduleSchema = z.object({
  savedReportId: z.string().uuid().describe("UUID of a live, supported saved report in this organization"),
  ...fields,
}).strict();
export const updateReportScheduleSchema = z.object({ ...fields,
  format: fields.format.removeDefault().describe("Attachment format: pdf, csv or xlsx"),
  timeOfDay: fields.timeOfDay.removeDefault().describe("Local HH:MM, 24-hour time"),
  timezone: fields.timezone.removeDefault().describe("Supported IANA timezone"),
  isActive: z.boolean().describe("Enable or pause scheduled delivery; manual trigger can run a paused schedule") })
  .partial().strict().refine(value => Object.keys(value).length > 0, "Provide a schedule field to update");
export const schedulePaginationSchema = z.object({
  page: z.number().int().min(1).max(1000000).default(1).describe("Page number, starts at 1, maximum 1000000"),
  limit: z.number().int().min(1).max(100).default(50).describe("Schedules per page, 1-100"),
}).strict();

type Timing = Pick<z.infer<typeof createReportScheduleSchema>, "frequency" | "dayOfWeek" | "dayOfMonth" | "timeOfDay" | "timezone">;

/** Resolve local calendar occurrences by round-trip, preserving timezone/DST rules. */
export function calculateNextReportRun(timing: Timing, from: Date): Date {
  if (!Number.isFinite(from.getTime())) throw new Error("Unsupported scheduling timestamp");
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timing.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const local = (date: Date) => {
    const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  };
  const start = new Date(local(from));
  const [hour, minute] = timing.timeOfDay.split(":").map(Number);
  for (let day = 0; day < 370; day++) {
    const candidate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + day, hour, minute));
    if (timing.frequency === "weekly" && candidate.getUTCDay() !== (timing.dayOfWeek ?? 1)) continue;
    if (["monthly", "quarterly"].includes(timing.frequency) && candidate.getUTCDate() !== (timing.dayOfMonth ?? 1)) continue;
    if (timing.frequency === "quarterly" && candidate.getUTCMonth() % 3 !== 0) continue;
    const target = candidate.getTime();
    // Offsets on both sides of a transition find both ambiguous instants. A gap has no round-trip.
    const offsets = new Set([-36, 0, 36].map(hours => {
      const sample = new Date(target + hours * 3600000);
      return local(sample) - sample.getTime();
    }));
    const matches = [...offsets].map(offset => new Date(target - offset))
      .filter(date => local(date) === target).sort((a, b) => a.getTime() - b.getTime());
    // One run per local calendar occurrence, using the earlier instant in a repeated DST hour.
    if (matches[0] && matches[0] > from) return matches[0];
  }
  throw new Error("No supported report occurrence in the next year");
}
