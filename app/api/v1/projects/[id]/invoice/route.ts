import { projectBillingRoute } from "@/lib/api/project-billing-route";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return projectBillingRoute(request, "invoice", id);
}
