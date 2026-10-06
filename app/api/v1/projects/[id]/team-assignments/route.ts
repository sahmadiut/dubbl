import { projectRoute } from "@/lib/api/project-master-route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "list_project_team_assignments", await params);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "assign_project_team", await params);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectRoute(request, "unassign_project_team", await params);
}
