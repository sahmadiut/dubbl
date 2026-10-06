import { projectBillingRoute } from "@/lib/api/project-billing-route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return projectBillingRoute(request, "preview", id);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return projectBillingRoute(request, "progress", id);
}
