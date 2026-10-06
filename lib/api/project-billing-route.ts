import { z } from "zod";
import { getAuthContext } from "./auth-context";
import { handleError } from "./response";
import { jsonResponse } from "./json-response";
import { projectQuery, readProjectJson } from "./project-master-wire";
import { executeProjectBilling, projectBillingPreview } from "./project-billing";
import type { BillingOperation } from "./project-billing-wire";

export async function projectBillingRoute(request: Request, op: BillingOperation | "preview", id: string) {
  try {
    const ctx = await getAuthContext(request), query = projectQuery(request);
    const body = request.method === "POST" ? await readProjectJson(request) : {};
    const invalid = (message: string): never => { throw new z.ZodError([{ code: "custom", path: [], message }]); };
    if (body === null || typeof body !== "object" || Array.isArray(body)) invalid("Expected JSON object");
    if (Object.hasOwn(body as object, "projectId") || Object.hasOwn(query, "projectId")) invalid("Project ID belongs in the path");
    if (Object.keys(query).some(k => op !== "unregister" || k !== "itemId")) invalid("Unexpected query field");
    const input = { ...body as object, ...query, projectId: id };
    const result = op === "preview" ? await projectBillingPreview(ctx, input) : await executeProjectBilling(ctx, op, input, request);
    return jsonResponse(result, { status: request.method === "POST" ? 201 : 200 });
  } catch (err) { return handleError(err); }
}
