import { z } from "zod";
import { assetDate, assetMasterId } from "./asset-master-wire";
const date = assetDate.optional().describe("Gregorian posting date YYYY-MM-DD; defaults to current UTC date");
const key = z.string().min(1).max(128).regex(/^[A-Za-z0-9_.:-]+$/).optional().describe("Retry key, 1..128 ASCII letters/digits/_.:-; same key must retain the same operation inputs");
export const assetDepreciationSchema = z.object({ date,
  unitsThisPeriod: z.number().int().min(0).max(2147483647).optional().describe("Physical units consumed, 0..2147483647; positive and required for units_of_production, forbidden for time-based methods"),
  idempotencyKey: key,
}).strict();
export const assetDepreciationBatchSchema = z.object({ date, idempotencyKey: key }).strict();
export const assetDepreciationRollbackSchema = z.object({ date, idempotencyKey: key,
  depreciationEntryId: assetMasterId.optional().describe("Expected latest depreciation entry UUID; older entries cannot be undone; omission selects latest with a daily retry guard"),
}).strict();
/** Empty legacy POST bodies remain supported; malformed/non-object JSON rejects. */
export async function readDepreciationJson(request: Request) {
  const text = await request.text();
  if (text === "") return {};
  try { return JSON.parse(text); } catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid depreciation JSON body" }]); }
}
