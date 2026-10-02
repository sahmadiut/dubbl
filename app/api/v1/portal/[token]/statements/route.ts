import { getPortalAccess, getPortalStatement } from "@/lib/api/public-portal";
import { ok, handleError } from "@/lib/api/response";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    return ok(await getPortalStatement(await getPortalAccess(token)));
  } catch (err) {
    return handleError(err);
  }
}
