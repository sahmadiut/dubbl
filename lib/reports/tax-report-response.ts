import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getTaxReport } from "./tax-reports";
import { taxReportQuery, type TaxReportKind } from "./tax-report-wire";

export async function taxReportResponse(request: Request, kind: TaxReportKind) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await getTaxReport(ctx, kind, taxReportQuery(request, kind)));
  } catch (error) { return handleError(error); }
}
