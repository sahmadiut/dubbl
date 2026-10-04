import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { importInventoryCsv } from "@/lib/api/inventory-master";
import { requireRole } from "@/lib/api/require-role";
import { AuthError } from "@/lib/api/auth-context";
export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request); requireRole(ctx, "manage:inventory");
    let form: FormData;
    try { form = await request.formData(); } catch { throw new AuthError("Invalid multipart CSV body", 400); }
    const file = form.get("file");
    if (!(file instanceof File)) throw new AuthError("No file provided", 400);
    if (file.size > 5000000) throw new AuthError("Maximum CSV file size is 5 MB", 400);
    return ok(await importInventoryCsv(ctx, await file.text(), request));
  } catch (error) { return handleError(error); }
}
