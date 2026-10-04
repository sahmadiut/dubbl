import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readTaxJson } from "@/lib/api/tax-rate-wire";
import { taxPeriodFileSchema, taxSettlementSchema } from "@/lib/api/tax-period-wire";
import { fileTaxPeriod, settleTaxPeriod } from "@/lib/api/tax-periods";
const bodySchema = z.discriminatedUnion("mode", [
  taxPeriodFileSchema.extend({ mode: z.literal("file").default("file").describe("File the open period; default file") }),
  taxSettlementSchema.extend({ mode: z.literal("settle").describe("Record a base-currency cash settlement") }),
]);
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), id = (await params).id;
    requireRole(ctx, "manage:tax-config");
    const raw = await readTaxJson(request);
    const parsed = bodySchema.parse(raw !== null && typeof raw === "object" && !Array.isArray(raw) && !("mode" in raw) ? { ...raw, mode: "file" } : raw);
    const { mode, ...values } = parsed;
    return jsonResponse(mode === "settle" ? await settleTaxPeriod(ctx, values, id, request) : await fileTaxPeriod(ctx, id, values, request));
  } catch (error) { return handleError(error); }
}
