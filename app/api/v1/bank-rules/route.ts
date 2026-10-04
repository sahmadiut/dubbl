import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { listBankRules, createBankRule } from "@/lib/api/bank-rules";
import { bankReadQuery } from "@/lib/api/bank-transaction-read-wire";
import { readBankRuleJson } from "@/lib/api/bank-rule-wire";
export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request), url = new URL(request.url);
    const { page, limit } = bankReadQuery(url, ctx.organizationId);
    const active = url.searchParams.get("isActive");
    if (active !== null && !["true", "false"].includes(active)) return jsonResponse({ error: "isActive must be true or false" }, { status: 400 });
    const result = await listBankRules(ctx, { page, limit, isActive: active === null ? undefined : active === "true" });
    return jsonResponse({ data: result.rules, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try { return jsonResponse({ bankRule: await createBankRule(await getAuthContext(request), await readBankRuleJson(request), request) }, { status: 201 }); }
  catch (error) { return handleError(error); }
}
