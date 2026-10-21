import { projectCrmJson } from "@/lib/money/project-crm-ui";
import type { RunningTimerData } from "@/app/(dashboard)/projects/[id]/project-context";
import { dateOnlyToDate } from "./dates";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid project time response");
  return value as Record<string, unknown>;
}

/** Validate the timer before adopting it; server diagnostics remain private. */
export async function projectTimerJson(response: Response, projectId: string) {
  if (!response.ok) throw new Error("Project timer failed");
  const body = await projectCrmJson(response);
  const timer = body?.timer;
  const text = (value: unknown) => typeof value === "string" && value.length > 0;
  const instant = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
  if (!timer || typeof timer !== "object" || Array.isArray(timer) || !text(timer.id) || timer.projectId !== projectId ||
    !text(timer.userId) || !instant(timer.startedAt) || (timer.pausedAt !== null && !instant(timer.pausedAt)) ||
    !Number.isSafeInteger(timer.accumulatedSeconds) || timer.accumulatedSeconds < 0 || typeof timer.isBillable !== "boolean" ||
    (timer.description !== null && typeof timer.description !== "string") || (timer.taskId !== null && !text(timer.taskId))) {
    throw new Error("Invalid project timer");
  }
  return body as { timer: RunningTimerData };
}

/** Require the saved entry, including its existing exact-money aliases, before success. */
export async function projectTimeEntryJson(response: Response, projectId: string, expectedId?: string) {
  if (!response.ok) throw new Error("Project time mutation failed");
  const body = record(await projectCrmJson(response)), entry = record(body.timeEntry);
  if (typeof entry.id !== "string" || !entry.id || (expectedId !== undefined && entry.id !== expectedId) || entry.projectId !== projectId ||
    typeof entry.date !== "string" || !dateOnlyToDate(entry.date) || !Number.isInteger(entry.minutes) || (entry.minutes as number) <= 0 ||
    (entry.minutes as number) > 2147483647 || typeof entry.isBillable !== "boolean") throw new Error("Invalid project time entry");
  return body;
}

export async function projectTimeDeleteJson(response: Response) {
  if (!response.ok || record(await projectCrmJson(response)).success !== true) throw new Error("Project time deletion failed");
}
