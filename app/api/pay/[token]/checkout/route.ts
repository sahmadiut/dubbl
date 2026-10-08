import { NextResponse } from "next/server";
import { createInvoiceCheckout } from "@/lib/integrations/stripe/checkout";
import { handleError } from "@/lib/api/response";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    return NextResponse.json(await createInvoiceCheckout(token, new URL(request.url).origin));
  } catch (err) { return handleError(err); }
}
