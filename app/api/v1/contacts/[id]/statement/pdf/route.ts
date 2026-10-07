import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { getContactStatement } from "@/lib/api/contact-statements";
import { contactQuery } from "@/lib/api/contact-statement-wire";
import { renderContactStatement } from "@/lib/api/contact-statement-delivery";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(request, new URL(request.url).searchParams.get("orgId") ?? undefined);
    const { id } = await params;
    const result = await getContactStatement(ctx, id, contactQuery(request, "statement", true));
    return new NextResponse(renderContactStatement(result), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) { return handleError(err); }
}
