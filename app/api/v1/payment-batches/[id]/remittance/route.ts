import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { getBatchRemittance, sendBatchRemittance } from "@/lib/api/remittance";
import { readCreditJson } from "@/lib/api/credit-wire";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    return jsonResponse(await getBatchRemittance(ctx, id));
  } catch (err) { return handleError(err); }
}
export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    const input = await request.text();
    return jsonResponse(await sendBatchRemittance(ctx, id, input.trim() ? await readCreditJson(new Request(request.url, { method: "POST", body: input })) : {}, request));
  } catch (err) { return handleError(err); }
}
