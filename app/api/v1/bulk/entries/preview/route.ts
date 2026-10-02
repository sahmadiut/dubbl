import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { jsonResponse } from "@/lib/api/json-response";
import { journalImportSource, previewJournalImport } from "@/lib/api/journal-import-wire";

export async function POST(request: Request) {
  try {
    await getAuthContext(request);
    const body = z.object({ source: journalImportSource, rows: z.array(z.record(z.string(), z.unknown())).default([]) }).parse(await request.json());
    return jsonResponse(previewJournalImport(body.rows, true, body.source));
  } catch (err) { return handleError(err); }
}
