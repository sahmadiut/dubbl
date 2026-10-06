import { projectRoute } from "@/lib/api/project-master-route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  return projectRoute(request, "list_project_task_checklist", await params);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  return projectRoute(request, "create_project_task_checklist_item", await params);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  return projectRoute(request, "update_project_task_checklist", await params);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  return projectRoute(request, "delete_project_task_checklist_item", await params);
}
