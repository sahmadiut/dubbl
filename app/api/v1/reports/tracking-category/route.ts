import { compoundResponse } from "@/lib/reports/compound-response";

export async function GET(request: Request) {
  return compoundResponse(request, "tracking-category");
}
