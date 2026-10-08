import { getAuthContext } from "@/lib/api/auth-context";
import { ok, handleError } from "@/lib/api/response";
import { getCashForecast } from "@/lib/reports/forecast-fx";
import { forecastFxQuery } from "@/lib/reports/forecast-fx-wire";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    return ok(await getCashForecast(ctx, forecastFxQuery(request, true)));
  } catch (err) { return handleError(err); }
}
