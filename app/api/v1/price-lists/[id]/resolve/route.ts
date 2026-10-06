import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { priceResolveSchema } from "@/lib/api/pricing-wire";
import { resolvePrice } from "@/lib/api/pricing";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), url = new URL(request.url);
    const query: Record<string, unknown> = {};
    for (const [key, value] of url.searchParams) {
      if (key in query) throw new z.ZodError([{ code: "custom", path: [key], message: "Repeated query parameter" }]);
      query[key] = value;
    }
    if (query.quantity !== undefined) {
      if (!/^[1-9]\d{0,9}$/.test(String(query.quantity))) throw new z.ZodError([{ code: "custom", path: ["quantity"], message: "Use a canonical whole quantity" }]);
      query.quantity = Number(query.quantity);
    }
    const p = priceResolveSchema.parse(query);
    return jsonResponse({ resolved: await resolvePrice(ctx.organizationId, p.inventoryItemId, (await params).id, p.quantity ?? 1, p.asOf) });
  } catch (err) { return handleError(err); }
}
