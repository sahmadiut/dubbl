import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataBackup } from "@/lib/db/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { z } from "zod";
import { createManualBackup } from "@/lib/api/backup-snapshot";
import { notDeleted } from "@/lib/db/soft-delete";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "view:audit-log");

    const url = new URL(request.url);
    const page = z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).parse(url.searchParams.get("page") ?? "1");
    const limit = Math.min(100, z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).parse(url.searchParams.get("limit") ?? "20"));
    const offset = z.number().int().safe().parse((page - 1) * limit);

    const whereClause = and(
      eq(dataBackup.organizationId, ctx.organizationId),
      notDeleted(dataBackup.deletedAt),
    );

    const [backups, [{ total }]] = await Promise.all([
      db.query.dataBackup.findMany({
        where: whereClause,
        orderBy: desc(dataBackup.createdAt),
        limit,
        offset,
      }),
      db
        .select({ total: count() })
        .from(dataBackup)
        .where(whereClause),
    ]);

    return NextResponse.json({ data: backups, total });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "view:audit-log");

    const updated = await createManualBackup(ctx);

    return NextResponse.json({ backup: updated }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
