import { projectRoute } from "@/lib/api/project-master-route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "get_project_timer", await params);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "start_project_timer", await params);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "update_project_timer", await params);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "discard_project_timer", await params);
}
