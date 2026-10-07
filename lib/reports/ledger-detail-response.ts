import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { getAccountTransactions, getGeneralLedger } from "./ledger-detail";
import { ledgerQuery, type LedgerKind } from "./ledger-detail-wire";

export async function ledgerDetailResponse(request: Request, kind: LedgerKind) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "view:data");
    const { input, format } = ledgerQuery(request, kind);
    if (kind === "account-transactions") return jsonResponse(await getAccountTransactions(ctx, input));
    const result = await getGeneralLedger(ctx, input, { allLines: format !== "json" });
    if (format === "json") return jsonResponse(result.data);
    const { toPdf, toXlsx } = await import("./statement-export");
    const buffer = await (format === "pdf" ? toPdf(result.statement()) : toXlsx(result.statement()));
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="general-ledger-${result.data.startDate}-${result.data.endDate}.${format}"`,
    } });
  } catch (error) { return handleError(error); }
}
