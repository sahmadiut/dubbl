import { projectRoute } from "@/lib/api/project-master-route";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  return projectRoute(request, "update_project_task", await params);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  return projectRoute(request, "delete_project_task", await params);
}
