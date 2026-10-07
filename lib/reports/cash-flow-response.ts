import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getCashFlow } from "./cash-flow-service";
import { cashFlowQuery } from "./cash-flow-wire";

export async function cashFlowResponse(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "view:data");
    const { input, format } = cashFlowQuery(request);
    const result = await getCashFlow(ctx, input);
    if (format === "json") return jsonResponse(result.data);
    const { toPdf, toXlsx } = await import("./statement-export");
    const buffer = await (format === "pdf" ? toPdf(result.statement()) : toXlsx(result.statement()));
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cash-flow-${result.data.startDate}-${result.data.endDate}.${format}"`,
    } });
  } catch (error) { return handleError(error); }
}
