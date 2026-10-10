# MON-126 attempt 1 - safe public invoice signing

## Identity

2026-10-10, Asia/Tehran. Operator coding-assistant, actual self-review only.
Entry master HEAD 0c1c918f2940ae2c922efdf96a23d47ecf4fdbba; tree clean.
Controller selected and started exactly MON-126. Changes were uncommitted when
this evidence was written; authorized scoped commit/push follows completion.

Fresh trust-authenticated PostgreSQL 18 cluster on loopback port 55426,
max_locks_per_transaction=256. TEST_DATABASE_URL explicitly selects that server;
fixtures create/migrate/drop randomly named databases. Application .env/DATABASE_URL
targets were not opened, modified or used. No real customer data, credentials,
SMTP/provider requests, build/dev server, Docker, migration to application DB or
deployment. Only fixture SMTP delivery is mocked; routes/services/SDK/SQL execute.

## Implementation and acceptance mapping

1. [INVOICE_SIGNING_WIRE_CONTRACTS](../registries/INVOICE_SIGNING_WIRE_CONTRACTS.md)
   documents all five public/authenticated boundaries and three MCP tools;
   strict UUID/text/email/ISO expiry/PNG inputs, safe signed minor-unit range,
   exact summary aliases, output envelopes/order, token scope, status/expiry,
   errors, currency-scaled rendering, transaction/SMTP limits and retained units.
   MONEY_MANIFEST and regenerated MONEY_BOUNDARIES inventory reflect adoption.
   Signature records carry no monetary fields or invented aliases.
2. Shared direct-DB request/list/resend and public read/sign services replace
   duplicated REST/MCP implementations. Full strict MCP object registration
   rejects unknown fields and describes every field. Explicit permissions and
   SQL-scoped live invoice/contact projections prevent tenant leakage. The
   disposable fixture invokes actual handlers, full registered MCP SDK linked
   transports, async SignPage and React static rendering; real legacy REST and
   exact MCP invoice writers produce unchanged 1250 minor-unit history. Tests
   cover foreign credentials, custom denied grants, deleted invoices/orgs,
   corrupted contact references, strict inputs and capability notFound behavior.
3. All five saved header amounts and SQL-text party JSON are preflighted before
   signature writes/email; opaque strings retain exact history without inferred
   units. Unsafe integer/decimal history fails 422 LEGACY_NUMERIC_RANGE. Public
   SSR shows an accessible error without a signing canvas. Currency display
   preserves zero/two/three decimals, negative subunits and both safe endpoints.
   Organization -> invoice -> signature locks serialize with corrections and
   lifecycle. Two actual public handlers yield one success/one rejection without
   overwrite. Actual correction/signing race permits correction only before
   signing; later correction rejects 409. A real lock wait verifies signing
   waits at organization, permits another writer to lock invoice, and rechecks
   expiry after release. Status/expiry failures preserve saved proof.

Request returns additive emailSent; absent SMTP creates a pending record without
delivery. Resend selects the newest active pending request, skips newer expired
rows and adds resentTo to REST. Email HTML escapes input; actual adapter calls
are captured in-process. Injected delivery failure rolls back newly inserted
requests. Reads use read-only repeatable-read snapshots. No signature operation
rewrites invoice amounts/status or posted/snapshot history.

Changed source: lib/api/invoice-signature-wire.ts, invoice-signatures.ts;
public sign POST/SSR, authenticated signature/resend adapters; MCP invoices.ts.
Added invoice-signatures runner/worker. Registries/evidence/task are task owned.
No schema change or Drizzle generation was required.

## Verification

All commands from D:/Projects/dubbl; all results actually awaited.

| Command | Result | Scope/timing |
|---|---|---|
| Explicit TEST_DATABASE_URL; node --import tsx --test --test-concurrency=1 tests/integration/invoice-signatures.test.ts tests/integration/invoice-snapshots.test.ts | Exit 0; 2/2 | Final PNG guard, typed contracts, rendering, request/list/resend/public handlers and snapshot regression. |
| Same disposable target; node --import tsx --test tests/integration/invoice-signatures.test.ts | Exit 0; 1/1 | Final rerun after self-review moved contact organization check into the SQL predicate. |
| pnpm test | Exit 0; 364/364 | Shared/static units; final later change only scoped the contact SQL predicate and was covered by the final signing fixture. |
| pnpm typecheck | Exit 0 | Final run includes all source/fixtures and final contact predicate. |
| pnpm lint | Exit 0; 0 errors, 105 existing warnings | Source/fixtures checked; final tiny predicate change separately checked with ESLint. |
| pnpm exec eslint all nine changed TS/TSX source/fixture files | Exit 0; 0 warnings/errors | Final subsequent contact predicate additionally checked by pnpm exec eslint lib/api/invoice-signatures.ts. |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Final inventory: 415 columns, 1917 files, 1423 consumer hashes, 27264 occurrences, current source verified. |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | No new legacy money uses. |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structurally valid 177-task controller and whitespace checks. |

Initial fixture failure used a bearer value without the dk_ API-key prefix, which
fell through to NextAuth outside Next request context. Corrected to an invalid
dk_ key to exercise actual API-key denial; final fixture passes. No production
auth code was changed. Early changed-file lint found two unused destructured
snapshot fields; narrowed the projection and verified zero changed-file warnings.
Self-review improved contact SQL scope and PNG envelope validation before final
acceptance. No remaining failures in completed checks.

## Review and limits

See MON-126-review-1.md for actual self-review. Real SMTP delivery, browser runtime,
identity/legal/security/accounting approval, full-int64 business support and
production IRR enablement are not claimed. SMTP is an external side effect: a
successful send followed by DB commit failure can leave a delivered link; no
outbox or exactly-once delivery was added. PNG envelope checks do not decode or
authenticate images/signers. Existing live invoice statuses, including draft,
remain eligible; general signed-document lifecycle policy is unchanged. Other
invoice lines/contact credit fields retain their existing domain owners.
MON-127 retains general SSR/PDF bridges; MON-034 independent integration remains.

## Handoff

All MON-126 criteria supported. Controller submit/self-review/done and authorized
task-owned commit/push follow this evidence. Next controller task MON-127; stop
after this task is pushed and remote/clean-tree synchronization is verified.
