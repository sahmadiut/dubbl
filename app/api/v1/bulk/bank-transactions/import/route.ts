import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { commitBulkBankImport } from "@/lib/api/bank-imports";
import { readBankAccountJson } from "@/lib/api/bank-account-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return jsonResponse(await commitBulkBankImport(ctx, await readBankAccountJson(request)), { status: 201 });
  } catch (error) { return handleError(error); }
}
