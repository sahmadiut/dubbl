import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataBackup } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { AuthError } from "@/lib/api/auth-context";
import { z } from "zod";
import { getOrgBackup } from "@/lib/api/backup-snapshot";
import { logAudit } from "@/lib/api/audit";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const backup = await getOrgBackup(ctx, id);

    return NextResponse.json({ backup });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "delete:organization");

    const { id } = await params;
    z.string().uuid().parse(id);

    const backup = await db.query.dataBackup.findFirst({
      where: and(
        eq(dataBackup.id, id),
        eq(dataBackup.organizationId, ctx.organizationId),
        notDeleted(dataBackup.deletedAt),
      ),
    });

    if (!backup) throw new AuthError("Backup not found", 404);

    // Soft-delete the backup record (S3 file kept for recovery via trash)
    await db
      .update(dataBackup)
      .set(softDelete())
      .where(eq(dataBackup.id, id));

    await logAudit({
      ctx,
      action: "delete",
      entityType: "data_backup",
      entityId: id,
      changes: backup as Record<string, unknown>,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
