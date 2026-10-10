import { handleError, ok } from "@/lib/api/response";
import { signPublicInvoice } from "@/lib/api/invoice-signatures";
import { signatureBody } from "@/lib/api/invoice-signature-wire";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try { return ok(await signPublicInvoice((await params).token, await signatureBody(request), request)); }
  catch (err) { return handleError(err); }
}
