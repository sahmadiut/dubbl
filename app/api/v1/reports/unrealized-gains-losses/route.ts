import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { getUnrealizedFx } from "@/lib/reports/forecast-fx";
import { forecastFxQuery } from "@/lib/reports/forecast-fx-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await getUnrealizedFx(ctx, forecastFxQuery(request, false)));
  } catch (err) { return handleError(err); }
}
