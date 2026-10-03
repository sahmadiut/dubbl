import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { voidSalesReceipt } from "@/lib/api/sales-receipts";
import { readSalesReceiptJson } from "@/lib/api/sales-receipt-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request); z.object({}).strict().parse(await readSalesReceiptJson(request, true));
    return ok(await voidSalesReceipt(ctx, (await params).id, request));
  } catch (err) { return handleError(err); }
}
