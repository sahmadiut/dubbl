import { z } from "zod";
import { WireCompatibilityError } from "@/lib/money/wire";

/** Opaque JSON has no implicit money fields, coercion, or invented exact aliases. */
export function validateLayoutJson(value: unknown): void {
  let nodes = 0;
  const ancestors = new Set<object>();
  const visit = (item: unknown, depth: number): void => {
    if (++nodes > 10000 || depth > 32) throw new TypeError("Layout JSON exceeds supported complexity");
    if (item === null || typeof item === "string" || typeof item === "boolean") return;
    if (typeof item === "number") {
      if (!Number.isFinite(item) || Math.abs(item) > Number.MAX_SAFE_INTEGER)
        throw new WireCompatibilityError("Layout JSON numbers must be finite and within the safe numeric range; preserve exact values as strings");
      return;
    }
    if (typeof item !== "object" || ancestors.has(item)) throw new TypeError("Layout config must contain JSON values only");
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null)
      throw new TypeError("Layout config must contain plain JSON objects");
    if (Object.getOwnPropertySymbols(item).length) throw new TypeError("Layout config cannot contain symbol keys");
    ancestors.add(item);
    if (Array.isArray(item)) {
      const descriptors = Object.getOwnPropertyDescriptors(item);
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (key !== "length" && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= item.length || !descriptor.enumerable || !("value" in descriptor)))
          throw new TypeError("Layout config arrays must contain ordinary JSON elements only");
      }
      for (let i = 0; i < item.length; i++) {
        if (!descriptors[i]) throw new TypeError("Layout config cannot contain sparse arrays");
        visit(descriptors[i].value, depth + 1);
      }
    } else {
      for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(item))) {
        if (!descriptor.enumerable || !("value" in descriptor)) throw new TypeError("Layout config cannot contain accessors or hidden properties");
        visit(descriptor.value, depth + 1);
      }
    }
    ancestors.delete(item);
  };
  visit(value, 0);
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 262144) throw new TypeError("Layout JSON exceeds 256 KiB");
}

const gridNumber = z.number().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)
  .describe("Finite safe numeric grid units; fractional coordinates remain supported, no monetary units");
// z.record silently discards a JSON object's own __proto__ key. Preserve opaque keys.
const configSchema = z.unknown().transform((value, ctx) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    ctx.addIssue({ code: "custom", message: "Widget config must be a JSON object" });
    return z.NEVER;
  }
  return value as Record<string, unknown>;
}).meta({ type: "object" })
  .describe("Opaque JSON object: safe finite numbers, strings, booleans, arrays, objects and null; exact strings preserved without interpretation");
export const dashboardWidgetSchema = z.object({
  widgetType: z.string().describe("Widget type identifier; existing and custom identifiers preserved"),
  x: gridNumber, y: gridNumber, w: gridNumber, h: gridNumber,
  config: configSchema.optional().describe("Optional opaque widget configuration; no bigint, unsafe numbers or automatic money conversion"),
}).strict();
export const createDashboardLayoutSchema = z.object({
  name: z.string().min(1).describe("Nonempty saved layout name"),
  isDefault: z.boolean().optional().describe("Optional default flag, defaults to false; other layouts are unchanged"),
  layout: z.array(dashboardWidgetSchema).describe("Ordered widget placements, with grid coordinates and optional opaque configs; up to 10000 JSON nodes, depth 32, 256 KiB"),
}).strict();
export const updateDashboardLayoutSchema = createDashboardLayoutSchema.partial().refine(
  value => Object.values(value).some(item => item !== undefined), "Provide at least one layout field",
);
export const dashboardLayoutIdSchema = z.string().uuid().describe("UUID of a layout owned by this user in this organization");

/** Validate the complete payload too, including geometry and aggregate config size. */
export function parseDashboardLayoutInput(input: unknown, update = false) {
  try { validateLayoutJson(input); } catch (err) {
    if (err instanceof WireCompatibilityError) throw err;
    throw new z.ZodError([{ code: "custom", path: [], message: (err as Error).message }]);
  }
  return update ? updateDashboardLayoutSchema.parse(input) : createDashboardLayoutSchema.parse(input);
}
