import { getAuthContext } from "@/lib/api/auth-context";
import { created, handleError } from "@/lib/api/response";
import { importGenericRows } from "@/lib/import-export/generic-import";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await importGenericRows(ctx, "products", await request.json(), request);
    return created({ job: result.job });
  } catch (error) { return handleError(error); }
}
