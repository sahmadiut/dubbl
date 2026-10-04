import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getBankImport } from "@/lib/api/bank-imports";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await getBankImport(ctx, (await params).id));
  } catch (error) { return handleError(error); }
}
