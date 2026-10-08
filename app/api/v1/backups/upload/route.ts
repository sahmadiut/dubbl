import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { uploadOrgSnapshot } from "@/lib/api/backup-snapshot";
import { invalidBackup } from "@/lib/api/backup-wire";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "delete:organization");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) invalidBackup("provide a JSON file");
    if (file.size > 20 * 1024 * 1024) invalidBackup("maximum file size is 20 MiB");
    return NextResponse.json({ backup: await uploadOrgSnapshot(ctx, await file.text()) });
  } catch (err) { return handleError(err); }
}
