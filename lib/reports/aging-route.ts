import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getAgingReport } from "./aging";
import { agingQuery } from "./aging-wire";

export async function agingRoute(request: Request, kind: "receivables" | "payables") {
  try {
    const ctx = await getAuthContext(request);
    const { input, format } = agingQuery(request);
    const { data, statement } = await getAgingReport(ctx, kind, input);
    if (format === "json") return jsonResponse(data);
    const { toPdf, toXlsx } = await import("./statement-export");
    const buffer = format === "pdf" ? await toPdf(statement) : await toXlsx(statement);
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="aged-${kind}-${data.asAt}.${format}"`,
    } });
  } catch (error) { return handleError(error); }
}
