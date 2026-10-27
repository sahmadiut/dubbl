import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { discoverAgentTools } from "@/lib/ai/tool-registry";
export async function GET(request: Request) { try { return ok(await discoverAgentTools(await getAuthContext(request), Object.fromEntries(new URL(request.url).searchParams))); } catch (err) { return handleError(err); } }
