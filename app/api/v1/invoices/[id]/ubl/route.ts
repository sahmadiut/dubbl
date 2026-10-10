import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { invoiceUbl, InvoiceUblValidationError } from "@/lib/api/invoice-ubl";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    const result = await invoiceUbl(ctx, id);
    return new NextResponse(result.xml, { headers: {
      "Content-Type": "application/xml", "Content-Disposition": `attachment; filename="${result.filename}"`,
    } });
  } catch (err) {
    if (err instanceof InvoiceUblValidationError) return jsonResponse({ error: err.message, details: err.details }, { status: err.status });
    return handleError(err);
  }
}
