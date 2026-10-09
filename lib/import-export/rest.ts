import { z } from "zod";
import { exportFiltersSchema, importJobsSchema } from "./generic-wire";

function query(request: Request) {
  const params = new URL(request.url).searchParams;
  if (new Set(params.keys()).size !== [...params.keys()].length) throw new z.ZodError([{ code: "custom", path: [], message: "Duplicate query parameters" }]);
  return Object.fromEntries(params);
}
export const exportQuery = (request: Request) => exportFiltersSchema.parse(query(request));
export function jobsQuery(request: Request) {
  const input = query(request);
  for (const key of ["limit", "offset"]) if (key in input && !/^(0|[1-9]\d*)$/.test(input[key])) {
    throw new z.ZodError([{ code: "custom", path: [key], message: "Expected a canonical integer query value" }]);
  }
  return importJobsSchema.parse({ ...input, ...(input.limit === undefined ? {} : { limit: Number(input.limit) }), ...(input.offset === undefined ? {} : { offset: Number(input.offset) }) });
}
