# MON-063 self-review 1

2026-10-04, Asia/Tehran. Reviewer codex, the implementing assistant. This is an
actual self-review of source/diff and executed fixtures, not peer/human approval.

## Findings and resolution

- Six REST GETs and described strict MCP tools share direct Drizzle/AuthContext
  reads; migrated legacy tool names are registered only once. Existing numeric
  fields/envelopes remain, with documented additive aliases/context and corrected
  pagination/currency/duplicate behavior. No REST self-calls or mutation work in
  these services; read-only repeatable-read enforces that invariant.
- Ownership is established before decoding transaction money. Parent deletion,
  nested imports/GL/journal/contact/reconciliation/tax/plain reference isolation,
  audit org scoping and sanitized user projection were inspected. Actual REST
  API-key expiry/custom permission/org spoofing and SDK foreign-org fixtures pass.
- Known money aliases validate safe numeric coexistence/null/sign without scaling
  or guessed history units. Opaque metadata retains its contract; generic unsafe
  Numbers reject. Audit root/allocation money adds aliases; percentage/count and
  opaque nested amount strings stay unchanged. Saved aliases cannot conflict.
- Match candidates filter document/payment/transfer currency. Base journal money
  is never compared to foreign bank amounts; complete bank-line net sums are
  bigint, with individual/aggregate and projected currency guards. Actual net
  1250 from multi-billion debit/credit, 5-billion candidate and unsafe aggregate
  cases pass. Integer <1%/<5% comparisons avoid float threshold errors.
- Duplicate SQL casts amount/date to text, then safe numeric conversion and exact
  aliases. Stable pagination/order and counts are guarded. Suggestion GL ownership
  joins prevent foreign-name disclosure. Top-N and partial pair limits are documented.
- Initial extraction/pagination/type defects were fixed; final fixtures pass.
  Initial parallel full suite exposed an existing startup timeout; sequential
  186/186 passed without weakening tests. Whole lint has 148 existing warnings,
  no errors; all touched TS files lint clean. Typecheck and inventories pass.

## Explicit limits

Safe +/-9007199254740991 money coexistence only; no full-int64 business adoption.
No posted history, schema, import/profile/match POST or other bank writers were
qualified by this read task. Alias addition never repairs already-rounded JSON.
Activity audit opaque identifiers/history remain generic contract work. Fuzzy
search still uses existing ASCII normalization. Samples and read diagnostics do
not prove reconciliation/settlement, fix AUD-002 or supersede MON-021 combined
gates. No independent accounting/security/locale/production/provider/IRR approval.
PostgreSQL 18 synthetic fixture environment only; no build/dev or deployment.

## Decision

Approve the bounded MON-063 acceptance criteria based on the documented source
and real fixture evidence, with the limits above. Complete through the controller,
commit and push as the user authorized, then stop. Next task MON-064.
