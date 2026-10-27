import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, ok } from "@/lib/api/response";
import { configureToolPolicy, listToolPolicies } from "@/lib/ai/tool-registry";
export async function GET(request: Request) { try { return ok(await listToolPolicies(await getAuthContext(request))); } catch (err) { return handleError(err); } }
export async function PUT(request: Request) { try { const ctx = await getAuthContext(request); let body: unknown; try { body = await request.json(); } catch { return new Response(null, { status: 400 }); } return ok(await configureToolPolicy(ctx, body)); } catch (err) { return handleError(err); } }
