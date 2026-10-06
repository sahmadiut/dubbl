import { projectRoute } from "@/lib/api/project-master-route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "list_project_members", await params);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "add_project_member", await params);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "update_project_member", await params);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "remove_project_member", await params);
}
