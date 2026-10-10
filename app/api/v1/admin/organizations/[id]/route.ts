import { NextResponse } from "next/server";
import { requireSiteAdmin } from "@/lib/api/require-site-admin";
import { readAdminOrganization, updateAdminOrganization } from "@/lib/api/admin-organization";
import { jsonResponse } from "@/lib/api/json-response";
import { handleError } from "@/lib/api/response";
import { parseOpaqueJson } from "@/lib/api/opaque-json";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSiteAdmin(request);
    if (auth instanceof NextResponse) return auth;
    return jsonResponse(await readAdminOrganization(auth.userId, (await params).id, auth.organizationId));
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSiteAdmin(request);
    if (auth instanceof NextResponse) return auth;
    let input: unknown;
    try { input = parseOpaqueJson(await request.text()); } catch (err) {
      if (err instanceof SyntaxError) return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
      throw err;
    }
    return jsonResponse(await updateAdminOrganization(auth.userId, (await params).id, input, auth.organizationId));
  } catch (err) { return handleError(err); }
}
