import { projectRoute } from "@/lib/api/project-master-route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  return projectRoute(request, "get_project_time_entry", await params);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  return projectRoute(request, "update_project_time_entry", await params);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  return projectRoute(request, "delete_project_time_entry", await params);
}
