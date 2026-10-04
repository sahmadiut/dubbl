import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { created, handleError } from "@/lib/api/response";
import { bulkCategorizeBankTransactions } from "@/lib/api/bank-categorization";
import { readBankCodingJson } from "@/lib/api/bank-categorization-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:banking");
    return created(await bulkCategorizeBankTransactions(ctx, await readBankCodingJson(request), request));
  } catch (error) { return handleError(error); }
}
