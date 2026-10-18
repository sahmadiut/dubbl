import type { useTranslations } from "next-intl";
import { z } from "zod";
import { projectCrmJson } from "@/lib/money/project-crm-ui";

type Translate = ReturnType<typeof useTranslations<"Accruals">>;
const statuses = { active: "running", completed: "finished", cancelled: "cancelled" } as const;
export function accrualStatusLabel(t: Translate, value: string) {
  return Object.hasOwn(statuses, value) ? t(statuses[value as keyof typeof statuses]) : value;
}

const minor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const entry = z.object({ id: z.string(), periodDate: z.string(), amount: minor, amountMinor: z.string(), posted: z.boolean(), journalEntryId: z.string().nullable(), sortOrder: z.number().int() }).passthrough();
const schedule = z.object({ id: z.string(), description: z.string(), totalAmount: minor, totalAmountMinor: z.string(), startDate: z.string(), endDate: z.string(), periods: z.number().int().min(1).max(1200), status: z.string(), entries: z.array(entry) }).passthrough();
const shapes = {
  list: z.object({ data: z.array(schedule), pagination: z.object({ total: z.number().int().nonnegative() }).passthrough() }).passthrough(),
  schedule: z.object({ schedule }).passthrough(),
  post: z.object({ entry }).passthrough(),
  cancel: z.object({ success: z.literal(true) }).passthrough(),
};

export class AccrualRequestError extends Error {}
/** Preserve exact aliases and reject malformed successes before adopting state or announcing success. */
export async function accrualJson<K extends keyof typeof shapes>(response: Response, t: Translate, fallback: string, expected: K): Promise<z.infer<typeof shapes[K]>> {
  if (!response.ok) {
    let code: unknown;
    try { code = (await response.json())?.code; } catch { /* Use status or reviewed fallback. */ }
    throw new AccrualRequestError(response.status === 401 ? t("unauthenticated")
      : response.status === 403 ? t("forbidden")
      : code === "LEGACY_NUMERIC_RANGE" ? t("invalidMoney")
      : response.status === 400 || response.status === 422 ? t("invalidInput") : fallback);
  }
  return shapes[expected].parse(await projectCrmJson(response)) as z.infer<typeof shapes[K]>;
}

const inputs = {
  "Enter a positive decimal accrual amount": "amountInvalid",
  "Accrual cents must be positive and within the supported range": "amountRange",
  "Enter a whole period count from 1 through 1200": "periodsInvalid",
} as const;
export function accrualFailureMessage(error: unknown, t: Translate, fallback: string) {
  if (error instanceof AccrualRequestError) return error.message;
  if (error instanceof RangeError && Object.hasOwn(inputs, error.message)) return t(inputs[error.message as keyof typeof inputs]);
  return fallback;
}
