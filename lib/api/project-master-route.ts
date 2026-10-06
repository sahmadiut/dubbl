import { getAuthContext } from "./auth-context";
import { handleError } from "./response";
import { jsonResponse } from "./json-response";
import { projectQuery, readProjectJson } from "./project-master-wire";
import { executeProjectOperation } from "./project-master";
import { projectOperations } from "./project-master-operations";
import { z } from "zod";

export async function projectRoute(request: Request, name: string, params: Record<string, string> = {}) {
  try {
    const ctx = await getAuthContext(request);
    const op = projectOperations.find(o => o.name === name)!;
    const query = projectQuery(request);
    const body = ["create", "update"].includes(op.action) && request.body !== null ? await readProjectJson(request) : {};
    const ids = { ...params };
    if (ids.id) { ids.projectId = ids.id; delete ids.id; }
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new z.ZodError([{ code: "custom", path: [], message: "Expected JSON object" }]);
    for (const key of Object.keys(ids)) if (Object.hasOwn(body, key) || Object.hasOwn(query, key)) throw new z.ZodError([{ code: "custom", path: [key], message: "Path identifiers cannot be supplied in the body or query" }]);
    if (op.queryId && Object.hasOwn(body, op.queryId)) throw new z.ZodError([{ code: "custom", path: [op.queryId], message: "Identifier belongs in the query string" }]);
    if (op.action !== "list" && Object.keys(query).some(key => key !== op.queryId)) throw new z.ZodError([{ code: "custom", path: [], message: "Unexpected query field" }]);
    const result = await executeProjectOperation(ctx, name, { ...body, ...query, ...ids }, request);
    return jsonResponse(result, { status: op.action === "create" ? 201 : 200 });
  } catch (err) { return handleError(err); }
}
