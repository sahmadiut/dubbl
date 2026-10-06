import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { cumulativeReportQuery } from "./statement-wire";
import { getCumulativeStatement } from "./cumulative-statement";

export async function cumulativeStatementResponse(request: Request, kind: "trial-balance" | "balance-sheet") {
  try {
    const ctx = await getAuthContext(request);
    const { input, format } = cumulativeReportQuery(request);
    const result = await getCumulativeStatement(ctx, kind, input);
    if (format === "json") return jsonResponse(result.data);
    const { toPdf, toXlsx } = await import("./statement-export");
    const buffer = await (format === "pdf" ? toPdf(result.statement()) : toXlsx(result.statement()));
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${kind}-${result.data.asAt}.${format}"`,
    } });
  } catch (error) { return handleError(error); }
}
