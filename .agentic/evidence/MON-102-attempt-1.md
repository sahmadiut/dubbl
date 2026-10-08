# MON-102 attempt 1 - combined aging, statements and payment performance

## Identity

2026-10-08, Asia/Tehran. Operator: codex. Repository D:/Projects/dubbl,
entry HEAD a57a0d75aa645a049abeb3e629868f50ab9fe5e8, master, clean entry tree.
Controller validate/status/next selected MON-102, the ready integration parent
of completed MON-111/112/113. Started exactly this task. Technical self-review;
no independent human/accounting/production approval or remote-CI claim.

## Implementation and acceptance mapping

1. [RECEIVABLE_PAYABLE_INTEGRATION](../registries/RECEIVABLE_PAYABLE_INTEGRATION.md)
   maps every report, contact read/delivery and aging export REST/MCP boundary,
   input/default/range, unit, alias, enclosing envelope, mode and scope. Detailed
   child maps and their original evidence remain unchanged. Updated TEST_MATRIX,
   MONEY_MANIFEST and source money inventory with parent integration coverage.
2. Added receivable-payable-integration.test.ts/worker. Actual legacy/exact REST
   invoice and MCP bill creation, existing recognition and actual REST/MCP cash
   settlement operations feed the same history. At February cutoff AR 2147484448
   minus AP 1500 equals general closing 2147482948; supplier closing equals AP.
   Prior movements produce opening 300. March cash lowers live AR to 800 while
   historical aging/statements exclude it. Performance includes gross documents
   issued in February, including March-paid invoices, totaling 2147484898.
   Retained paidAt values are explicitly pinned in the fixture because settlement
   stamps wall-clock time, independently of cash date. This distinction is
   documented rather than silently changing the application timing contract.
3. Actual API-key REST and registered MCP SDK calls compare complete payloads
   and every numeric/Minor pair. Tenant keys with contradictory headers cannot
   retarget another organization; foreign contact reads return 404. Invalid keys,
   denied and allowed custom readers, invalid dates, unknown fields and email
   permission/date/currency failures are exercised. Financial/audit/config
   snapshots remain unchanged across reads/errors; authentication lastUsedAt
   bookkeeping is excluded. Bigint does not reach unguarded JSON serialization.
4. The parent fixture exposed unknown input being stripped by contact MCP raw
   schema registration before shared validation. All five contact tools now pass
   full strict Zod objects to registerTool. The existing financial-export tool
   also uses a complete strict object, covering its aging export paths. Valid
   inputs, tool names/descriptions, output envelopes and computations stay the
   same. Full financial and ledger-export regressions pass for the shared tool.
5. Actual USD aging XLSX totals and REST/MCP cells agree; foreign exports retain
   only their own totals. IRR/JPY/KWD filtered JSON amounts and XLSX currency
   scales preserve existing integer units. Activity retains per-item currencies.
   Print and recorded email share exact escaped statement totals; invalid input,
   mixed currency and unsupported stored int64 reject before any new delivery.
   Child suites independently cover signed safe edges, overflow/cancellation,
   dated/carrier allocation rules, saved dates, pagination, escaping and PDF
   signatures. No child evidence or completed task was rewritten.

## Fixture and verification

Task-created PostgreSQL 16 cluster bound only to 127.0.0.1:55502, synthetic
fixture role, UTC timezone. Explicit TEST_DATABASE_URL selected that server.
Harness created, migrated and dropped random dubbl_ci_ databases, never the
configured application DB. Cluster stopped after all DB checks. Nodemailer was
recorded in memory; no real mail or provider call. All commands ran at repo root.

| Actual command/check | Result | Limits |
|---|---|---|
| python .agentic/agent.py validate/status/next/context/start | Exit 0, 173 structurally valid tasks | Not financial qualification |
| node --import tsx --test --test-concurrency=1 tests/integration/receivable-payable-integration.test.ts tests/integration/aging.test.ts tests/integration/contact-statement.test.ts tests/integration/payment-performance.test.ts tests/integration/financial-report-integration.test.ts | Exit 0, 5/5, no skips | All three children and financial regressions; before final parent assertion additions |
| node --import tsx --test --test-concurrency=1 tests/integration/receivable-payable-integration.test.ts tests/integration/ledger-detail.test.ts | Final exit 0, 2/2, no skips | Final parent aliases/custom-reader/export/date/email assertions; shared export regression |
| pnpm test | Exit 0, 359/359, no skips | Pure/unit suite |
| pnpm typecheck | Final exit 0 | MDX/tsc, no full build |
| pnpm exec eslint lib/mcp/tools/contact-statements.ts lib/mcp/tools/reports.ts tests/integration/receivable-payable-integration.test.ts tests/integration/receivable-payable-integration-worker.ts | Final exit 0, no warnings/errors | All changed TS files |
| pnpm lint | Exit 0, 0 errors, 106 warnings in unchanged files | Existing warnings retained; changed-file lint clean |
| python .agentic/scripts/money_inventory.py --write | Exit 0, 415 columns, 1865 scanned files, 1396 consumers, 26449 occurrences | Lexical inventory only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, 415 Drizzle columns, 1396 hashes/occurrence lines verified | Source gate, not migration qualification |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks passed | Legacy usage gate |
| git diff --check | Exit 0 | Git LF/CRLF notices only |

Initial fixture missed its synthetic EMAIL_ENCRYPTION_KEY; the harness now sets
it as the existing contact fixture does. Initial typecheck required an explicit
numeric annotation for the recorded delivery counter; corrected. The substantive
unknown-field assertion then failed against existing contact registration and
passed after strict schema repair. Final focused DB/static checks passed after
all assertion additions. Full lint also passed with zero errors.

## Review and handoff

See separate MON-102-review-1 for the final self-review; all checks are complete.
No schema edits/migration, history rewrite, currency rescale, IRR flag, full build,
dev server, Docker, browser/visual print, live SMTP or deployment. Public portal
remains its existing owner. Historical/event-sourced/full-range/performance,
independent accounting and production gates remain separate. MON-029 retains
broader report integration acceptance. Commit/push is explicitly authorized by
the user's request; this evidence precedes that action and records no remote SHA.
