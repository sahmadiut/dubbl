import { projectRoute } from "@/lib/api/project-master-route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  return projectRoute(request, "list_project_task_comments", await params);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  return projectRoute(request, "create_project_task_comment", await params);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  return projectRoute(request, "delete_project_task_comment", await params);
}
