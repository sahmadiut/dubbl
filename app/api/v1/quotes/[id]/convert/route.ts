import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { convertQuote } from "@/lib/api/quotes";
import { QuoteOverbillingError } from "@/lib/api/quote-wire";
import { jsonResponse } from "@/lib/api/json-response";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), text = await request.text();
    let body: unknown = {};
    if (text.trim()) {
      try { body = JSON.parse(text); }
      catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid JSON conversion body" }]); }
    }
    return ok(await convertQuote(ctx, (await params).id, body, request));
  } catch (err) {
    if (err instanceof QuoteOverbillingError) return jsonResponse({ error: err.message, ...err.amounts }, { status: 400 });
    return handleError(err);
  }
}
