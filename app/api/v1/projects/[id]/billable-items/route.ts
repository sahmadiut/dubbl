import { projectBillingRoute } from "@/lib/api/project-billing-route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return projectBillingRoute(request, "list", id);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return projectBillingRoute(request, "register", id);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return projectBillingRoute(request, "unregister", id);
}
