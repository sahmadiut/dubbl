import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getKpiAnalytics } from "./kpi-analytics";
import { kpiAnalyticsQuery, type KpiAnalyticsKind } from "./kpi-analytics-wire";

export async function kpiAnalyticsRoute(request: Request, kind: KpiAnalyticsKind) {
  try {
    const ctx = await getAuthContext(request);
    const { input, format } = kpiAnalyticsQuery(request, kind);
    const result = await getKpiAnalytics(ctx, kind, input);
    if (format === "json") return jsonResponse(result.data);
    const statement = "statement" in result ? result.statement : undefined;
    if (!statement) throw new Error("Missing executive statement");
    const { toPdf, toXlsx } = await import("./statement-export");
    const buffer = format === "pdf" ? await toPdf(statement) : await toXlsx(statement);
    const period = "period" in result.data ? result.data.period : undefined;
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="executive-summary-${period!.startDate}-${period!.endDate}.${format}"`,
    } });
  } catch (error) { return handleError(error); }
}
