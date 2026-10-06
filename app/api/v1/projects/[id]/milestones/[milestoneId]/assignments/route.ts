import { projectRoute } from "@/lib/api/project-master-route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; milestoneId: string }> }) {
  return projectRoute(request, "list_project_milestone_assignments", await params);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; milestoneId: string }> }) {
  return projectRoute(request, "create_project_milestone_assignment", await params);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; milestoneId: string }> }) {
  return projectRoute(request, "mark_project_milestone_assignment_paid", await params);
}
