# MON-033 attempt 1 - exact generic import and export contracts

## Identity

2026-10-10, Asia/Tehran. Operator coding-assistant, implementing model.
Repository D:/Projects/dubbl, master, clean entry at 291e964c. Task selected by
validate/status/next and started with the controller. These results precede the
task commit; no invented commit SHA, peer/human review or remote CI result.

PostgreSQL 16 was started from the existing local runtime in a fresh task-specific
temporary cluster on 127.0.0.1:56333 with a synthetic CREATEDB role. Explicit
TEST_DATABASE_URL opted the fixture harness into that loopback server. Each test
created, migrated and dropped a randomly named disposable DB; final matching
database count was 0 and pg_ctl stopped the cluster successfully. The application
database and .env were not opened or mutated.

## Implementation

- `lib/import-export/generic-wire.ts`, `generic-import.ts`, `generic-export.ts`
  and `rest.ts` own bounded strict schemas, exact price aliases/preflight,
  CSV mapping, previews/jobs and all CSV projections. REST bulk account/contact/
  product preview/import, job listing and eight export routes now use those
  direct-DB services; MCP uses the same services through wrapTool and complete
  strict SDK input objects.
- Product decimal parsing uses bigint hundredths and rejects partial numbers,
  extra precision, invalid grouping, unsupported source/row metadata and unsafe
  numeric/exact values before job insertion. source mappings include canonical
  aliases; known account/contact type aliases normalize, unknown types fail.
- Per-row savepoints retain successful rows after duplicates. Job finalization
  and audit commit with the rows; injected final-audit failure rolls back every
  row and job. Product imports reuse the MON-075 inventory creation helper
  within the existing transaction, keeping movement, valuation, opening GL and
  posting locks rather than inserting unvalued quantity alone. Currency checks
  precede jobs under the organization lock. Generated codes check owned history.
- CSV text retains fixed-two legacy columns with additive Minor strings and
  saved currency metadata. Bigint quotient/remainder formatting preserves
  signed safe endpoints. Date validation and filters are shared, master date
  filters reject and the UI forwards dates only for transactional selections.
  Export reads use repeatable-read read-only transactions; ZIP files share one
  snapshot. Parent scoping, live bank ownership and foreign label/reference
  guards precede responses. Actual rowCount counts multiline records once.
- `csv-utils.ts` provides bounded quoted parsing and scalar forwarding, shared
  by the wizard/dashboard/custom CSV and scheduled spreadsheet attachment.
  XLSX money/Minor cells remain text; unsafe Numbers and nonscalar cells reject.
  `zip.ts` now writes actual CRC32 checksums and UTF-8 name flags. An independent
  Python ZIP reader verified the generated archive.
- `lib/mcp/tools/import-export.ts` has eight strict single-operation tools,
  including mapped preview and complete ZIP export. Existing journal import/
  preview keep their MON-036 units/services and gain strict full registration.
  The journal denial fixture now supplies that tool's valid input to exercise
  authorization rather than fail earlier at unknown-control validation.
- `GENERIC_IMPORT_EXPORT_WIRE_CONTRACTS.md`, MONEY_MANIFEST, source inventory and
  the user import/export guide document every operation, envelope, units, exact
  alias, supported range and explicit limitation. No schema edits or migrations
  were authored; no stored units or flags were rescaled/switched.

## Acceptance mapping

1. The contract registry maps all three direct import/preview pairs, source
   templates/mappings/preprocessing, job history, seven individual CSV exports,
   ZIP, existing journal MCP coordination and shared CSV/XLSX forwarding. It
   distinguishes fixed-two compatibility text from currency-scaled display,
   monetary Minor strings from scaled physical quantities, page counts and dates.
2. `generic-import-export-worker.ts` invokes actual API-key-authenticated REST
   handlers and full-registry linked MCP SDK tools. REST decimal and exact clients,
   MCP decimal and exact CSV clients preserve 29, 1250, above-int32 and the safe
   endpoint. Every import/preview/export/tool schema is checked for permissions
   or strict registration. Conflicting org headers, foreign readers/labels/line
   accounts and job pages demonstrate tenant isolation; unsafe persisted bank
   bigint data fails CSV and ZIP. Stock creates 3 units with exact value 87 and
   a two-line balanced real GL journal with debit/credit 87.
3. Fifteen related domain/financial/import/audit table snapshots assert no writes
   for malformed aliases, fractional quantities, unsupported type/source/currency,
   empty imports, unsafe inputs/derived opening values, auth/tenant denials and
   export errors. Duplicate-row savepoints, replay failures and injected final
   audit rollback are independently asserted. CSV/XLSX forwarding and independent
   ZIP checksum verification cover no float/unit/serialization loss within scope.

## Verification

All commands ran from D:/Projects/dubbl. Results below are the final observed
successful checks; initial failures and corrections are recorded after the table.

| Actual command/procedure | Result | Scope / limits |
|---|---|---|
| `node --import tsx --test tests/generic-import-export.test.ts` | Exit 0, 5/5 | Decimal/alias/CSV/scalar forwarding/independent ZIP groups |
| `pnpm test` | Final exit 0, 364/364 | Whole pure suite including 5 new groups |
| Explicit TEST_DATABASE_URL; `node --import tsx --test --test-concurrency=2 tests/integration/generic-import-export.test.ts tests/integration/inventory-master.test.ts tests/integration/journal-lifecycle-wire.test.ts tests/integration/report-schedules.test.ts tests/integration/custom-reports.test.ts` | Final exit 0, 5/5 | Migrated disposable DBs, real handlers and SDK; existing serialized XLSX signed endpoint and domain checks |
| `pnpm typecheck` | Final exit 0 | MDX generation and tsc only, no build |
| `pnpm exec eslint` on every changed/new TS/TSX file | Exit 0, no warnings/errors | Actual changed/new path arrays supplied |
| `pnpm lint` | Final exit 0, 0 errors, 105 existing warnings | No new changed-file warnings |
| `python .agentic/scripts/money_inventory.py --write`, then without write | Final exit 0 | 415 columns, 1901 scanned files, 1409 consumers, 27200 occurrences |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Final exit 0 | Actual Drizzle/source hashes and lines agree |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0, nine regression checks | Legacy-money import/reference guard |
| `python .agentic/agent.py validate`; `git diff --check` | Exit 0 | Controller structure/whitespace; Git LF/CRLF notices only |
| Isolated-server database count / pg_ctl stop | Count 0 / exit 0, stopped | No leftover fixture DBs; no application DB access |

Initial typecheck corrected the organization's actual field name defaultCurrency
and dashboard export's typed-object compatibility. The real negative quantity
fixture found that Zod's regex failure did not prevent a later BigInt refinement
from throwing: the refinement now verifies syntax itself and returns a validation
error. Real journal CSV found an unused numeric rateExact passed through relational
JSON into the FX codec as Number; that unused field is excluded from the projection,
leaving stored FX untouched. Strict MCP journal registration invalidated a denial
fixture's multipurpose input; the permission assertion now uses the proper journal
import schema. A reversed-period fixture was aligned with wrapTool's actual Zod
`isError`/Validation error envelope, which does not include a status field. Final
integration, pure/static and money checks pass after these corrections. The
fixture's expected audit-failure 500 deliberately logs its synthetic DB error;
it is a successful rollback assertion, not an outstanding runtime failure.

No full build, dev server, Docker, application migration, deployment, screenshot,
live-provider action, production IRR enablement or remote CI waiting was performed.

## Review and handoff

See MON-033-review-1.md for the implementing operator's technical self-review.
No remaining blocker within this slice. Commit/push only this task's files under
the user's explicit request, verify remote SHA and clean status, then stop.
MON-034 owns remaining opaque/rendering adoption; MON-016 retains separate parent
integration acceptance. Full-int64 business/ORM support, currency display cutover,
historical remediation, independent accounting and release remain separate gates.
