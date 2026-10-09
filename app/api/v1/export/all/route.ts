import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { genericExportAll } from "@/lib/import-export/generic-export";
import { exportQuery } from "@/lib/import-export/rest";
import { createZip } from "@/lib/import-export/zip";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const files = await genericExportAll(ctx, exportQuery(request));
    return new NextResponse(Buffer.from(createZip(files)), { headers: { "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=dubbl-export.zip" } });
  } catch (error) { return handleError(error); }
}
