import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { compensationEquity } from "@/lib/api/payroll-compensation";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const result = await compensationEquity(ctx);
    return ok({ data: result });
  } catch (err) { return handleError(err); }
}
