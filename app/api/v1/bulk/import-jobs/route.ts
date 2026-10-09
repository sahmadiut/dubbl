import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { listGenericImportJobs } from "@/lib/import-export/generic-import";
import { jobsQuery } from "@/lib/import-export/rest";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const { jobs } = await listGenericImportJobs(ctx, jobsQuery(request));
    return ok({ jobs });
  } catch (error) { return handleError(error); }
}
