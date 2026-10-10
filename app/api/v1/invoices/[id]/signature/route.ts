import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok, created } from "@/lib/api/response";
import { getInvoiceSignatures, requestInvoiceSignature } from "@/lib/api/invoice-signatures";
import { signatureBody } from "@/lib/api/invoice-signature-wire";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    const ctx = await getAuthContext(request);
    return created(await requestInvoiceSignature(ctx, (await params).id, await signatureBody(request), new URL(request.url).origin));
  } catch (err) { return handleError(err); }
}
export async function GET(request: Request, { params }: Context) {
  try { return ok(await getInvoiceSignatures(await getAuthContext(request), (await params).id)); }
  catch (err) { return handleError(err); }
}
