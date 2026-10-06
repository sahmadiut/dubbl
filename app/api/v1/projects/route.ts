import { projectRoute } from "@/lib/api/project-master-route";

export async function GET(request: Request) {
  return projectRoute(request, "list_projects");
}

export async function POST(request: Request) {
  return projectRoute(request, "create_project");
}
