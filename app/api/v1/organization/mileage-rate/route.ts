import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { getOrganizationMileageRate, updateOrganizationMileageRate } from "@/lib/api/organization-settings";
import { readOrganizationJson } from "@/lib/api/organization-wire";

export async function GET(request: Request) {
  try { return ok(await getOrganizationMileageRate(await getAuthContext(request))); }
  catch (err) { return handleError(err); }
}
export async function PUT(request: Request) {
  try { return ok(await updateOrganizationMileageRate(await getAuthContext(request), await readOrganizationJson(request), request)); }
  catch (err) { return handleError(err); }
}
