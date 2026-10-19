# Review the Persian MDX translations

From the repository root, run:

```powershell
node scripts/review-mdx-translations.mjs --list
node scripts/review-mdx-translations.mjs --limit 1
node scripts/review-mdx-translations.mjs
```

The last command reviews all outstanding pairs in alphabetical English-path order,
one pair per API request with no previous chat history. English files are read only.
The API approves the existing Persian with `ok`, or returns a complete improved
translation. Only validated replacements are applied, with a backup first.
Dedicated Stripe documents are listed as `excluded_stripe`, following `AGENTS.md`.
The script does not change `meta.json` navigation files.

The ignored `.env.mdx-review.local` file contains the supplied URL and key:

```dotenv
MDX_REVIEW_BASE_URL=http://master.sajjad.engineer:20128/v1
MDX_REVIEW_API_KEY=your-api-key
MDX_REVIEW_MODEL=ag/gemini-3.8-flash-high
```

Environment variables take precedence over the env file. `--model` and `--base-url`
override both. The application `.env` is never read. Use `--models` to list models.

## Progress and restart

The git-ignored `.mdx-review/` directory contains:

- `progress.md`: the ordered English/Persian file list, statuses and review reasons.
- `progress.csv`: the same list, encoded as UTF-8 with BOM for Excel.
- `manifest.json`: hashes and per-file progress for restarting.
- `jobs/<hash>/request.json`, `response.json`, `job.json`: request, saved API answer,
  attempt count and metadata; no Authorization header or API key is saved here.
- `jobs/<hash>/wire-response.txt`: the original JSON/event-stream response, saved
  before decoding; it can also be reused after interruption.
- `jobs/<hash>/before.fa.mdx`: the exact original Persian before a replacement.
- `jobs/<hash>/prepared.json`: a checkpoint used to finish interrupted edits.
- `jobs/<hash>/invalid-response-*.json`: rejected answers retained for inspection.

Rerun the same command after failures or interruption. Completed pairs with the
same source, output and review settings are skipped. Changed source/translation,
model, endpoint or prompt triggers a fresh review. Do not delete the state directory
if you want to keep progress. Avoid manual MDX edits during a review; if a file
changes, the script records `conflict` and does not overwrite that change.

Responses are flushed to disk before edits. If interrupted after saving an answer,
restarting reuses it. A crash after applying an edit but before updating the
manifest also recovers without another request. A lock prevents overlapping runs
against the same state directory; a dead local process's lock is recovered on
restart. Use one state directory per document root.

The script sends a stable `Idempotency-Key` for each input pair/settings combination.
Transport retries reuse that key; rejected model answers start a new generation
with a new key so the API can produce a corrected answer.
Absolute exactly-once delivery after a timeout or a crash *before* the response is
saved requires the API to honor that key. Otherwise an ambiguous request may be
sent again. Already checkpointed successful reviews are not resent.

Ctrl+C requests a stop after the active pair and its checkpoint finish. For a run
in another terminal, create `.mdx-review/STOP` to request the same graceful stop;
the runner consumes that file. Force-kill
is recoverable, subject to the response-delivery limit described above. The runner
does not start a background process itself.

## Retries and validation

Each pending or failed pair gets up to three API attempts per invocation, using
exponential backoff for network errors, HTTP 408/409/425/429/5xx, and honoring
`Retry-After`. Malformed JSON, incomplete output, or an unsafe replacement also
triggers retries within that same budget. Authentication/endpoint errors stop the
batch; other failures are listed and the runner continues. The next invocation
automatically retries failures while skipping successful files.
The default request timeout is 600 seconds for large documents. The runner asks
for `stream:false` and accepts both ordinary JSON and complete OpenAI-style SSE
streams, since this gateway may return SSE. Incomplete streams are rejected.

Before applying an edit, the script parses YAML and MDX, checks the original
Persian AST against the replacement, and compiles the replacement in memory.
Only prose and frontmatter `title`/`description` may change. When the translation
omits source content, the model must restore the complete English structure,
including missing code and links. The candidate must match either the existing
Persian or the English AST exactly except for prose, and must not have fewer
headings, paragraphs, list/table items, code blocks, images or links than English.
An `ok` response with structural omissions is rejected and retried.
Code, imports/exports, expressions, JSX attributes, inline code, links and other
metadata remain protected. JSX attribute labels are deliberately protected;
their translation requires a separate explicit edit. These checks prevent broken
or injected MDX; linguistic accuracy still depends on the review model.

No Next build, dev server, database, or application MCP/REST API is used. Parser
dependencies come from the existing `fumadocs-mdx` installation; no new packages
are required. Use Node 20.12+ (or a newer Node release) and install project
dependencies first.

Useful options:

```powershell
node scripts/review-mdx-translations.mjs --help
node scripts/review-mdx-translations.mjs --only concepts/index.mdx
node scripts/review-mdx-translations.mjs --model ag/gemini-3.8-flash-high
node scripts/review-mdx-translations.mjs --attempts 5 --timeout 240
```

`--limit` counts outstanding pairs processed, including failures, rather than
unchanged skips. The default combined pair budget is 120,000 UTF-8 bytes; larger
pairs are marked `blocked` without an API call. Raise `--max-input-bytes` explicitly
to allow them. This is a byte safety limit, not an exact token counter. Output is
limited to 32,768 tokens per request via `max_tokens`; use `--max-output-tokens` to
change it. The endpoint must support `/chat/completions`, JSON response mode, and
the selected model.

Exit status is 0 for success/inventory, 1 for failures/conflicts/blocked or missing
counterparts, and 130 for a graceful interrupt. `excluded_stripe` is informational.

Run the local regression tests (mock API only):

```powershell
node --test scripts/review-mdx-translations.test.mjs
npx eslint scripts/review-mdx-translations.mjs scripts/review-mdx-translations.test.mjs
```
