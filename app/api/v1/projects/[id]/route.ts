import { projectRoute } from "@/lib/api/project-master-route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "get_project", await params);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "update_project", await params);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "delete_project", await params);
}
