import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { resendInvoiceSignature } from "@/lib/api/invoice-signatures";
import { signatureBody } from "@/lib/api/invoice-signature-wire";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    const ctx = await getAuthContext(request);
    // Existing dashboard sends no body; accept that or a strict empty object.
    const input = request.body === null ? {} : await signatureBody(request);
    z.strictObject({}).parse(input);
    return ok(await resendInvoiceSignature(ctx, (await params).id, new URL(request.url).origin));
  } catch (err) { return handleError(err); }
}
