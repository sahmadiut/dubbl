import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { readBankAccountJson } from "@/lib/api/bank-account-wire";
import { previewBankImport, commitBankImport } from "@/lib/api/bank-imports";
import { statementFields } from "@/lib/api/bank-import-wire";

const schema = z.object({ ...statementFields, mode: z.enum(["preview", "commit"]).default("commit") }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    const { mode, ...body } = schema.parse(await readBankAccountJson(request));
    return mode === "preview" ? jsonResponse(await previewBankImport(ctx, id, body))
      : jsonResponse(await commitBankImport(ctx, id, body), { status: 201 });
  } catch (error) { return handleError(error); }
}
