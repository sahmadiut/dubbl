import { getPortalAccess, getPortalInvoices } from "@/lib/api/public-portal";
import { ok, handleError } from "@/lib/api/response";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    return ok(await getPortalInvoices(await getPortalAccess(token, undefined, 404), request.headers.get("x-forwarded-for")));
  } catch (err) {
    return handleError(err);
  }
}
