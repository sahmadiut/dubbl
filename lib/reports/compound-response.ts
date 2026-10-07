import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { compoundQuery, type CompoundKind } from "./compound-wire";
import { getTrackingReport, getReportPack, getFinancialRatios } from "./compound";

export async function compoundResponse(request: Request, kind: CompoundKind) {
  try {
    const ctx = await getAuthContext(request);
    const { input, format } = compoundQuery(request, kind);
    if (kind === "financial-ratios") return jsonResponse(await getFinancialRatios(ctx, input));
    let buffer: Buffer;
    let filename: string;
    if (kind === "pack") {
      const result = await getReportPack(ctx, input);
      if (format === "json") return jsonResponse(result.data);
      const { toWorkbookXlsx } = await import("./statements-workbook");
      buffer = await toWorkbookXlsx(result.statements);
      filename = `report-pack-${result.data.startDate}-${result.data.endDate}.xlsx`;
    } else {
      const result = await getTrackingReport(ctx, input);
      if (format === "json") return jsonResponse(result.data);
      const { toPdf, toXlsx } = await import("./statement-export");
      buffer = format === "pdf" ? await toPdf(result.statement()) : await toXlsx(result.statement());
      const dimension = result.data.dimension === "projectId" ? "project" : "cost-center";
      filename = `tracking-${dimension}-${result.data.startDate}-${result.data.endDate}.${format}`;
    }
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    } });
  } catch (error) { return handleError(error); }
}
