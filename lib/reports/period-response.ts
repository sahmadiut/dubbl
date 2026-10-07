import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { requireRole } from "@/lib/api/require-role";
import { getIncomeStatement, getPnlComparison, getProfitLoss } from "./period-statement";
import { periodReportQuery, type PeriodReportKind } from "./period-statement-wire";

export async function periodStatementResponse(request: Request, kind: PeriodReportKind) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "view:data");
    const { input, format } = periodReportQuery(request, kind);
    if (kind === "income-statement") return jsonResponse(await getIncomeStatement(ctx, input));
    if (kind === "pnl-comparison") return jsonResponse(await getPnlComparison(ctx, input));
    const result = await getProfitLoss(ctx, input);
    if (format === "json") return jsonResponse(result.data);
    const { toPdf, toXlsx } = await import("./statement-export");
    const buffer = await (format === "pdf" ? toPdf(result.statement()) : toXlsx(result.statement()));
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="profit-and-loss-${result.data.startDate}-${result.data.endDate}.${format}"`,
    } });
  } catch (error) { return handleError(error); }
}
