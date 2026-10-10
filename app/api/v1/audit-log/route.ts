import { getAuthContext } from "@/lib/api/auth-context";
import { listAuditLog } from "@/lib/api/audit-log";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const input: Record<string, unknown> = Object.fromEntries(new URL(request.url).searchParams);
    for (const key of ["page", "limit"]) if (typeof input[key] === "string" && /^\d+$/.test(input[key])) input[key] = Number(input[key]);
    return jsonResponse(await listAuditLog(ctx, input));
  } catch (err) { return handleError(err); }
}
