import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { downloadOrgBackup } from "@/lib/api/backup-snapshot";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request), { id } = await params;
    const json = await downloadOrgBackup(ctx, id);
    return new NextResponse(json, { headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename=dubbl-backup-${id}.json`,
    } });
  } catch (err) { return handleError(err); }
}
