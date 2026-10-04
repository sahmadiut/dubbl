import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { created, handleError } from "@/lib/api/response";
import { recordBankTransfer } from "@/lib/api/bank-transfers";
import { readBankTransferJson } from "@/lib/api/bank-transfer-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:banking");
    return created(await recordBankTransfer(ctx, await readBankTransferJson(request), request));
  } catch (err) { return handleError(err); }
}
