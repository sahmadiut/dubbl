import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { currencyRegime } from "@/lib/db/schema";
import type { AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";

export const listCurrencyRegimesSchema = z.object({
  isoCode: z.string().regex(/^[A-Z]{3}$/).optional().describe("Optional uppercase ISO currency code; no toman alias"),
}).strict();

/** Catalogue only: never select a regime or convert a posted amount by date. */
export async function listCurrencyRegimes(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const params = listCurrencyRegimesSchema.parse(input);
  const regimes = await db.select().from(currencyRegime).where(and(
    eq(currencyRegime.organizationId, ctx.organizationId),
    params.isoCode ? eq(currencyRegime.isoCode, params.isoCode) : undefined,
  )).orderBy(currencyRegime.isoCode, currencyRegime.regimeKey);
  return { regimes };
}
