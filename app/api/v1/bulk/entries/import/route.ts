import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { requireRole } from "@/lib/api/require-role";
import { journalImportSource, parseJournalImportRows } from "@/lib/api/journal-import-wire";
import { importJournals } from "@/lib/api/journal-import";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:entries");
    const body = z.object({ fileName: z.string().min(1), source: journalImportSource,
      post: z.boolean().default(false), rows: z.array(z.record(z.string(), z.unknown())).min(1) }).parse(await request.json());
    const rows = parseJournalImportRows(body.rows, true, body.source);
    const result = await importJournals(ctx, rows, body.fileName, body.post, request);
    return jsonResponse({ job: result.job }, { status: 201 });
  } catch (err) { return handleError(err); }
}
