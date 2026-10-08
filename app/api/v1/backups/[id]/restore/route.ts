import { z } from "zod";
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { restoreFromSnapshot } from "@/lib/api/backup-snapshot";
import { invalidBackup } from "@/lib/api/backup-wire";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "delete:organization");

    const { id } = await params;
    z.string().uuid().parse(id);
    z.object({ confirm: z.literal(true) }).strict().parse(await request.json().catch(() => invalidBackup("invalid JSON request")));

    const restoredCounts = await restoreFromSnapshot(ctx.organizationId, id, ctx);

    return NextResponse.json({ success: true, restoredCounts });
  } catch (err) {
    return handleError(err);
  }
}
