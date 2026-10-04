import { requireRole } from "@/lib/api/require-role";
import { getAuthContext } from "@/lib/api/auth-context";
import { created, handleError } from "@/lib/api/response";
import { createBankExpense } from "@/lib/api/bank-categorization";
import { readBankCodingJson } from "@/lib/api/bank-categorization-wire";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    requireRole(ctx, "manage:expenses");
    return created(await createBankExpense(ctx, id, await readBankCodingJson(request), request));
  } catch (error) { return handleError(error); }
}
