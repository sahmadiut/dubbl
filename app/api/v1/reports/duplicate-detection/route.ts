import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getDuplicateReport } from "@/lib/reports/operational";
import { operationalQuery } from "@/lib/reports/operational-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await getDuplicateReport(ctx, operationalQuery(request, "duplicates")));
  } catch (err) { return handleError(err); }
}
