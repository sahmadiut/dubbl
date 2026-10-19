# Translate English MDX to Persian

Run from the repository root:

```powershell
node scripts/review-mdx-translations.mjs
```

Only English document content is sent to the API. The script translates each
English `.mdx` file into its `.fa.mdx` counterpart, creating missing Persian files.
Existing Persian text is read locally only for backup and conflict detection;
it is never used as translation input, heading context, or part of a request.
English files are read only. Dedicated Stripe files are excluded per `AGENTS.md`.
Navigation `meta.json` files are outside this script's scope.

## Chunks and concurrency

Large pages are split at complete MDX block boundaries, preferring headings.
The defaults are **6,000 English UTF-8 bytes** or **120 English lines** per chunk,
with **three API requests active at most**, shared across all files and chunks.
Code fences, JSX elements, tables and other individual MDX blocks remain intact.
These sizes are soft targets: a single larger block stays together. The hard
per-request English input budget is 120,000 bytes; oversized indivisible blocks
are reported without sending a request. Byte limits are not exact token counts.

Each chunk contains English source plus a short English heading context, with
no chat history. Only the first chunk includes frontmatter. The API returns JSON
containing `persian_mdx`, with no approval/review step. Output limits are 8,192
tokens per chunk and 32,768 tokens for small whole-page requests.

Completed chunk results are saved separately. The final Persian page is assembled
in source order and checked for valid YAML/MDX before one atomic replacement.
An existing target is backed up first. If any chunk fails, its successful siblings
stay cached and the target remains unchanged. Restarting requests only unfinished
chunks. An input file changed during translation is reported as a conflict.

The script checks MDX syntax, Persian encoding, and string `title`/`description`
frontmatter. It does not compare structures, links or code with the original.
Translation quality and semantic changes are reviewed by the owner in Git.
Generated JavaScript is compiled in memory, never executed. No Next build, dev
server, database or application MCP/REST calls are involved.

## Progress, terminal and reset

An interactive terminal shows a live dashboard with file/chunk counts, three
request slots, elapsed time, bytes received, output characters and recent events.
Redirected output uses readable timestamped lines. `--plain` forces that log mode;
`NO_COLOR=1` disables dashboard colors. Progress updates every five seconds.

The ignored `.mdx-review/` directory contains:

- `manifest.json`, `progress.md`, `progress.csv`: English/Persian file queue and status.
- `chunks.csv`: detailed per-chunk status, attempts, input size and cache use.
- `jobs/<hash>/plan-*.json`: ordered English source chunks.
- `jobs/<hash>/chunks/<hash>/`: request, raw/decoded response, attempt metadata and result.
- `jobs/<hash>/before.fa.mdx`: exact previous Persian before replacement.
- `jobs/<hash>/assembled.fa.mdx`: assembled output for chunked pages.
- `jobs/<hash>/prepared.json`: interrupted-edit recovery checkpoint.

Keep that directory to resume. Completed translations are skipped when the
English source and model/settings are unchanged. Owner edits to completed Persian
files are preserved. Deleting a target recreates it from cached translation.

To deliberately restart every translation:

```powershell
node scripts/review-mdx-translations.mjs --reset --list
node scripts/review-mdx-translations.mjs
```

Reset archives managed progress, responses and backups under
`.mdx-review-history/<timestamp>/`, then creates a fresh queue. It preserves current
Persian files. Old bilingual-review responses are not reused in English-only mode.
`--reset` can also be used alone to reset and immediately translate.

Ctrl+C cancels active and queued requests while keeping completed checkpoints.
Alternatively, create `.mdx-review/STOP` to finish active files and stop queuing
more files; the runner consumes that file. A lock prevents overlapping invocations
using the same state. Stale local-process locks are recovered on restart.

Network, timeout, malformed JSON and invalid MDX failures receive up to three
attempts per chunk per invocation. Transport retries use exponential backoff and
honor `Retry-After`; rejected answers start a new idempotency generation. Request
deadlines cover headers and body, plus a separate 60-second no-data limit. The
total timeout defaults to 600 seconds and can be changed with `--timeout`.
The runner handles both JSON and SSE, finishing on the terminal SSE event rather
than waiting for the connection to close. Authentication/endpoint errors stop
the queue. Other exhausted failures are recorded while remaining files continue.

Absolute exactly-once delivery when a request times out or the process crashes
before saving the response requires the gateway to honor `Idempotency-Key`.
Successfully checkpointed requests are reused without sending them again.

## Configuration and examples

The supplied credentials live in the ignored `.env.mdx-review.local`:

```dotenv
MDX_REVIEW_BASE_URL=http://master.sajjad.engineer:20128/v1
MDX_REVIEW_API_KEY=your-api-key
MDX_REVIEW_MODEL=ag/gemini-3.8-flash-high
```

The user's current env file/model selection is preserved. Environment variables
take precedence; CLI `--model`/`--base-url` override them. Application `.env` is not
loaded. Node 20.12+ and installed project dependencies are required; MDX parsers
come from the existing `fumadocs-mdx` installation, with no new packages.

```powershell
node scripts/review-mdx-translations.mjs --help
node scripts/review-mdx-translations.mjs --models
node scripts/review-mdx-translations.mjs --dry-run --only api-reference.mdx
node scripts/review-mdx-translations.mjs --limit 1
node scripts/review-mdx-translations.mjs --concurrency 3 --chunk-bytes 6000 --chunk-lines 120
node scripts/review-mdx-translations.mjs --plain --timeout 180
```

`--list` and `--dry-run` make no API calls or MDX edits. Dry-run previews chunk
counts/sizes. `--limit` limits outstanding files, with their chunks still using
the shared request pool. Exit codes: 0 success/inventory, 1 failures/conflicts,
130 interruption. Stripe exclusion is informational.

Regression checks (mock API only):

```powershell
node --test scripts/review-mdx-translations.test.mjs
npx eslint scripts/review-mdx-translations.mjs scripts/review-mdx-translations.test.mjs scripts/mdx-review-chunks.mjs scripts/mdx-review-terminal.mjs
```
