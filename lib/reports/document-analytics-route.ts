import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getDocumentAnalytics, type DocumentAnalyticsKind } from "./document-analytics";
import { documentAnalyticsQuery } from "./document-analytics-wire";

export async function documentAnalyticsRoute(request: Request, kind: DocumentAnalyticsKind) {
  try {
    const ctx = await getAuthContext(request);
    const { input, format } = documentAnalyticsQuery(request, kind !== "vendor-spend");
    const { data, statement } = await getDocumentAnalytics(ctx, kind, input);
    if (format === "json") return jsonResponse(data);
    const { toPdf, toXlsx } = await import("./statement-export");
    const buffer = format === "pdf" ? await toPdf(statement!) : await toXlsx(statement!);
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${kind}-${data.startDate}-${data.endDate}.${format}"`,
    } });
  } catch (error) { return handleError(error); }
}
