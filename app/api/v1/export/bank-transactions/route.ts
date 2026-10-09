import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { genericExport } from "@/lib/import-export/generic-export";
import { exportQuery } from "@/lib/import-export/rest";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await genericExport(ctx, "bank-transactions", exportQuery(request));
    return new NextResponse(result.csv, { headers: { "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=bank-transactions.csv" } });
  } catch (error) { return handleError(error); }
}
