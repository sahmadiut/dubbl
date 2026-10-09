import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { requireRole } from "@/lib/api/require-role";
import { importPermission } from "@/lib/import-export/generic-import";
import { previewGenericRows } from "@/lib/import-export/generic-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, importPermission["accounts"]);
    return ok(previewGenericRows("accounts", await request.json()));
  } catch (error) { return handleError(error); }
}
