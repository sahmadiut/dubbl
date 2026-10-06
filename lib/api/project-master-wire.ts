import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { legacyMinor, exactMinorSchema, WireCompatibilityError, stringifyWire } from "@/lib/money/wire";

export const projectIdSchema = z.string().uuid().describe("UUID of the scoped project or referenced record");
const text = z.string().min(1).describe("Nonempty plain text");
const description = z.string().nullable().optional().describe("Optional text; null clears it");
const ref = projectIdSchema.nullable().optional().describe("Scoped UUID; null clears the reference");
const date = rateDateSchema.nullable().optional().describe("Canonical Gregorian YYYY-MM-DD date; null clears it");
export const projectMinutes = z.number().int().min(0).max(2147483647).describe("Whole physical minutes, 0 through signed int32 maximum; never money");
const order = z.number().int().min(-2147483648).max(2147483647).describe("Signed int32 ordering index");
const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).refine(v => !Object.is(v, -0)).describe("Nonnegative integer cents, at most 9007199254740991");
const minor = exactMinorSchema.refine(v => !v.startsWith("-")).describe("Canonical nonnegative integer cents string; supported numeric coexistence range through 9007199254740991");
const role = z.enum(["manager", "contributor", "viewer"]).describe("Project access role");
const priority = z.enum(["low", "medium", "high", "urgent"]).describe("Priority label");
const strings = z.array(z.string()).max(1000).describe("Ordered text labels, not financial amounts");
const flag = z.boolean().describe("Enable or disable this feature");
function amounts(fields: string[], nullable = false) {
  return Object.fromEntries(fields.flatMap(f => [[f, (nullable ? money.nullable() : money).optional().describe(`${f}: integer cents${nullable ? "; null clears the override" : ""}`)],
    [`${f}Minor`, (nullable ? minor.nullable() : minor).optional().describe(`${f}: exact canonical integer cents string${nullable ? "; null clears the override" : ""}`)]]));
}
export const projectMoneyFields = {
  project: ["budget", "hourlyRate", "fixedPrice", "totalBilled"], member: ["hourlyRate", "costRate"],
  time: ["hourlyRate"], milestone: ["amount", "invoicedAmountCents"], assignment: ["amount"],
} as const;
export function projectAmounts(input: Record<string, unknown>, fields: readonly string[], defaults = false) {
  const result = { ...input };
  for (const field of fields) {
    const n = result[field], s = result[`${field}Minor`];
    if (n !== undefined || s !== undefined) {
      if (n !== undefined && s !== undefined && (n === null || s === null ? n !== s : BigInt(n as number) !== BigInt(s as string)))
        throw new z.ZodError([{ code: "custom", path: [field], message: "Numeric and exact cents aliases must agree" }]);
      result[field] = s === null ? null : s !== undefined ? legacyMinor(BigInt(s as string)) : n;
    } else if (defaults) result[field] = 0;
    delete result[`${field}Minor`];
  }
  return result;
}
function describedPartial(shape: Record<string, z.ZodType>) {
  return Object.fromEntries(Object.entries(shape).map(([key, field]) => [key, field.optional().describe(field.description ?? key)]));
}
const projectShape = {
  name: text, description, contactId: ref,
  status: z.enum(["active", "completed", "on_hold", "cancelled", "archived"]).optional().describe("Project lifecycle status"),
  priority: priority.optional().describe("Project priority"),
  billingType: z.enum(["hourly", "fixed", "milestone", "non_billable"]).optional().describe("Billing policy"),
  color: text.optional().describe("Display color"), ...amounts(["budget", "hourlyRate", "fixedPrice"]),
  estimatedHours: projectMinutes.optional().describe("Estimated whole minutes despite the historical field name"),
  currency: currencyCodeSchema.optional().describe("Saved ISO currency label; existing cents are not rescaled"),
  startDate: date, endDate: date, category: description, tags: strings.optional().describe("Project tags"),
  enableTimeline: flag.optional().describe("Show timeline"), enableTasks: flag.optional().describe("Show tasks"),
  enableTimeTracking: flag.optional().describe("Show time tracking"), enableMilestones: flag.optional().describe("Show milestones"),
  enableNotes: flag.optional().describe("Show notes"), enableBilling: flag.optional().describe("Show billing"),
};
const taskShape = { title: text, description,
  status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]).optional().describe("Task status"),
  priority: priority.optional().describe("Task priority"), assigneeId: ref, teamId: ref, startDate: date, dueDate: date,
  estimatedMinutes: projectMinutes.nullable().optional().describe("Whole estimated minutes; null means unknown"), labels: z.array(projectIdSchema).max(1000).optional().describe("Label UUIDs belonging to this project") };
const timeShape = { date: rateDateSchema.describe("Canonical Gregorian work date"), description,
  minutes: projectMinutes.min(1).describe("Positive whole work minutes through int32 maximum"),
  isBillable: flag.optional().describe("Whether this entry is billable"), ...amounts(["hourlyRate"]), taskId: ref };
const milestoneShape = { title: text, description, dueDate: date, ...amounts(["amount"]) };
const timerShape = { description, taskId: ref, isBillable: flag.optional().describe("Whether the timer is billable") };
export const projectSchemas = {
  projectCreate: z.object(projectShape).strict(), projectUpdate: z.object(describedPartial(projectShape)).strict(),
  projectList: z.object({ page: z.number().int().min(1).max(2147483647).default(1).describe("One-based page"),
    limit: z.number().int().min(1).max(100).default(50).describe("Page size, at most 100"),
    status: projectShape.status, priority: projectShape.priority }).strict(),
  memberCreate: z.object({ memberId: projectIdSchema, role: role.optional().describe("Project role, defaults to contributor"), ...amounts(["hourlyRate", "costRate"], true) }).strict(),
  memberUpdate: z.object({ memberId: projectIdSchema, role: role.optional().describe("New project role"), ...amounts(["hourlyRate", "costRate"], true) }).strict(),
  timeCreate: z.object(timeShape).strict(), timeUpdate: z.object(describedPartial(timeShape)).strict(),
  page: z.object({ page: z.number().int().min(1).max(2147483647).default(1).describe("One-based page"), limit: z.number().int().min(1).max(100).default(50).describe("Page size through 100") }).strict(),
  timerCreate: z.object(timerShape).strict(),
  timerUpdate: z.object({ ...timerShape, pausedAt: z.iso.datetime({ offset: true }).nullable().optional().describe("ISO instant with timezone; null resumes from the current instant"),
    accumulatedSeconds: projectMinutes.optional().describe("Whole accumulated physical seconds through int32 maximum") }).strict(),
  milestoneCreate: z.object(milestoneShape).strict(),
  milestoneUpdate: z.object(describedPartial({ ...milestoneShape, status: z.enum(["upcoming", "in_progress", "completed", "overdue"]).optional().describe("Milestone status"),
    progressPercent: z.number().int().min(0).max(100).optional().describe("Whole progress percent, 0 through 100; never money"), sortOrder: order.optional().describe("Ordering index") })).strict(),
  assignmentCreate: z.object({ ...amounts(["amount"]), description, employeeId: projectIdSchema.optional().describe("Scoped payroll employee UUID"), memberId: projectIdSchema.optional().describe("Scoped organization member UUID") }).strict(),
  taskCreate: z.object(taskShape).strict(), taskUpdate: z.object(describedPartial({ ...taskShape, sortOrder: order.optional().describe("Ordering index") })).strict(),
  checklistCreate: z.object({ title: text }).strict(),
  checklistUpdate: z.object({ items: z.array(z.object({ id: projectIdSchema, title: text.optional().describe("New title"), isCompleted: flag.optional().describe("Completion state"), sortOrder: order.optional().describe("Ordering index") }).strict()).min(1).max(1000).describe("Atomic batch of items from this task; duplicate IDs reject") }).strict(),
  commentCreate: z.object({ content: text }).strict(), labelCreate: z.object({ name: text, color: text.optional().describe("Display color") }).strict(),
  noteCreate: z.object({ content: text, isPinned: flag.optional().describe("Pin this note") }).strict(),
  noteUpdate: z.object({ content: text.optional().describe("Updated text"), isPinned: flag.optional().describe("Pin this note") }).strict(),
  teamCreate: z.object({ name: text, color: text.optional().describe("Display color"), memberIds: z.array(projectIdSchema).max(1000).optional().describe("Distinct member UUIDs from this organization") }).strict(),
  teamAssignmentCreate: z.object({ teamId: projectIdSchema, defaultRole: role.optional().describe("Role for this organization team assignment") }).strict(),
};
export function projectRowDto(kind: string, input: Record<string, unknown>) {
  const result = { ...input };
  try {
    for (const field of projectMoneyFields[kind as keyof typeof projectMoneyFields] ?? []) {
      const value = result[field];
      if (value === null && kind === "member") result[`${field}Minor`] = null;
      else { money.parse(value); result[`${field}Minor`] = String(value); }
    }
    for (const field of ["minutes", "totalHours", "estimatedHours", "estimatedMinutes", "accumulatedSeconds"])
      if (result[field] !== undefined && result[field] !== null) projectMinutes.parse(result[field]);
    if (result.progressPercent !== undefined) z.number().int().min(0).max(100).parse(result.progressPercent);
    if (result.sortOrder !== undefined) order.parse(result.sortOrder);
    if (kind === "task" && result.labels !== undefined) z.array(projectIdSchema).max(1000).parse(result.labels);
    for (const field of ["date", "startDate", "endDate", "dueDate"])
      if (result[field] !== undefined && result[field] !== null) rateDateSchema.parse(result[field]);
    if (result.currency !== undefined && currencyCodeSchema.parse(result.currency) !== result.currency) throw new Error("Currency is not canonical");
    if (result.startDate && result.endDate && String(result.startDate) > String(result.endDate)) throw new Error("Date order");
    if (result.startDate && result.dueDate && String(result.startDate) > String(result.dueDate)) throw new Error("Date order");
    if (kind === "milestone" && BigInt(result.invoicedAmountCents as number) > BigInt(result.amount as number)) throw new Error("Invoiced amount exceeds milestone");
    stringifyWire(result); return result;
  } catch { throw new WireCompatibilityError("Unsupported saved project money, quantity, date, currency or billing history"); }
}
export function projectQuery(request: Request) {
  const values: Record<string, unknown> = Object.create(null);
  for (const [key, value] of new URL(request.url).searchParams) {
    if (Object.hasOwn(values, key)) throw new z.ZodError([{ code: "custom", path: [key], message: "Duplicate query field" }]);
    if (key === "page" || key === "limit") {
      if (!/^[1-9]\d{0,9}$/.test(value)) throw new z.ZodError([{ code: "custom", path: [key], message: "Expected canonical positive integer" }]);
      values[key] = Number(value);
    } else values[key] = value;
  }
  return values;
}
export async function readProjectJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid project JSON body" }]); }
}
