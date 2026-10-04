import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { created, handleError } from "@/lib/api/response";
import { matchBankTransfer } from "@/lib/api/bank-transfers";
import { readBankTransferJson } from "@/lib/api/bank-transfer-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    requireRole(ctx, "manage:banking");
    return created(await matchBankTransfer(ctx, id, await readBankTransferJson(request), request));
  } catch (err) { return handleError(err); }
}
