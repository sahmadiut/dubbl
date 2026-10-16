# MON-009 attempt 1 - IRR metadata and currency-regime expansion

## Identity and scope

2026-10-16, Asia/Tehran. Operator coding-assistant (Codex), self-review only.
Entry master HEAD `caae9dc9ca089973efc696e852ea36e824a89deb`, clean working tree.
Live validate/status/next selected MON-009; start claimed exactly this task.
Read repository/nested instructions, controller/project/map/backend role, task,
MON-005/MON-008 dependency evidence, requirement sections, and actual currency,
schema, REST/MCP, migration, backup and exact-money contracts. Used the memory
Dubbl controller-task skill for workflow; live controller state took precedence.
No other task was started or delegated. User authorized commit/push.

## Implementation and acceptance mapping

1. **Minimal ICU and display:** `lib/currency/irr-metadata.ts` supplies explicit
   IRR name, code, fallback symbol and zero decimal places. `iso4217.ts` retains
   IRR when enumeration is missing, throws or returns a partial list, and tolerates
   absent DisplayNames. Runtime IRR fraction metadata cannot override the pinned
   policy. Existing exact ledger scales stay unchanged. Unit subprocesses replace
   these Intl capabilities before module initialization; legacy/exact display
   retains 1250 and 4000000003 whole rials, without fractional suffix or rescaling.
   The existing currency-create route defaults from the currency metadata and
   rejects conflicting IRR scales; actual REST and MCP currency lists expose zero.

2. **Coexisting regimes without historical rewrite:** new organization-owned
   `currency_regime` table has stable key/UUID, ISO code, inclusive nullable date
   bounds, display exponent, same-tenant predecessor, exact positive factor,
   official flag and source/verification provenance. Unconstrained numeric plus
   SQL 20/18-digit checks rejects excess precision instead of typmod rounding.
   The factor direction is previous major units per ONE regime major unit.
   Null predecessor requires null factor; self/foreign predecessor, invalid
   precision/exponents/dates/codes and nonpositive/nonfinite factors reject.
   Metadata is immutable, with organization cascade deletion retained.

   Generated migration `0012_currency_regimes.sql`, snapshot and journal expand
   the schema, seed existing organizations and seed new organizations atomically
   through a trigger. There is no financial-table update or guessed regime-ID
   backfill. The current baseline has unspecified dates, no predecessor/factor
   and official=false. A labelled synthetic future regime in a disposable
   database retains factor `10000.000000000000000001` exactly alongside the
   baseline; complete posted-row SQL-text snapshots and balanced debit/credit
   totals `4000000003` remain unchanged across migration, replay and coexistence.

   `GET /api/v1/currency-regimes` and registered MCP `list_currency_regimes` use
   one strict schema/service with `view:data`, AuthContext organization scope,
   optional uppercase isoCode and `{ regimes }` response. Both reject unknown
   fields; forged org headers cannot switch the authenticated API-key tenant.
   Denied/foreign/invalid requests and direct SQL mutation failures are exercised.
   New tools use direct DB access and wrapTool; all Zod fields have descriptions.

3. **No speculative cutover or toman conversion:** verified Unicode CLDR 48
   IRR digits=0 and compared current main. The CBI home page returned content,
   but subsequent retrieval was unreliable; no usable primary operational date,
   final ISO treatment or conversion policy was established. This does not prove
   that no announcement exists. The registry records sources and these limits.
   No future policy row/date/factor or IRT alias is seeded. The application IRR
   financial gate stays false; existing rollout tests still reject premature
   enablement. Dates/factors used only in fixtures are not Iranian monetary facts.

   This is metadata expansion before any ledger regime cutover. Existing untagged
   financial records keep their saved-unit contract. Actual alternative-regime
   activation still needs official evidence, explicit document/ledger snapshots,
   provenance-based historical treatment, reviewed reporting conversion and
   financial/release qualification. Catalogue dates never reinterpret postings.

See [currency registry](../registries/CURRENCY_REGIMES.md),
[test matrix](../docs/TEST_MATRIX.md),
[unit fixtures](../../tests/currency-regimes.test.ts), and
[integration fixture](../../tests/integration/currency-regimes.test.ts).
The inventory classifies both new numeric columns as metadata, not money/FX.

## Actual verification

All commands ran from D:/Projects/dubbl. PostgreSQL 18 was a new dedicated
loopback cluster, port 55109, trust authentication for synthetic user dubbl_ci.
`TEST_DATABASE_URL` was explicit; each fixture created/dropped a randomized
database. `PG_BIN` pointed to the installed matching PostgreSQL 18 client.
No configured application database was migrated or queried.

Final joint integration command:

```text
node --import tsx --test --test-concurrency=2
  tests/integration/currency-regimes.test.ts
  tests/integration/fx-history.test.ts tests/integration/fx-exact.test.ts
  tests/integration/money-bigint.test.ts tests/integration/migrations.test.ts
  tests/integration/backups.test.ts
```

| Command/procedure | Actual result | Limit |
|---|---|---|
| npx drizzle-kit generate; npx --no-install drizzle-kit generate --name currency_regimes | Exit 0; final 0012 SQL/snapshot/journal generated | SQL adds explicit seeding/immutability triggers after generated schema |
| Final joint integration command above | Exit 0, 20/20, no skips, 112.621 seconds | Real REST, linked registered MCP and independent SQL; synthetic/disposable data |
| pnpm test (final rerun) | Exit 0, 554/554, 14.360 seconds | Unit/behavior/static suite; no browser |
| Focused currency-regimes, iso4217 and currency-rollout unit command | Exit 0, 15/15 | Final metadata and gate behavior |
| pnpm typecheck | Exit 0 | fumadocs-mdx plus tsc; no build |
| ESLint with all 12 owned TypeScript paths | Exit 0, no errors/warnings | Final source/schema/fixture state |
| pnpm lint | Exit 0, zero errors/81 existing warnings | Warnings remain in unchanged files |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0; 417 columns, 2111 scanned files, 1585 consumers, 31026 occurrences | Lexical inventory, not transitive proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Actual Drizzle columns, source hashes and occurrence lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, nine regression checks | Existing compatibility allowances remain |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Controller structure and whitespace only |
| Local Markdown link check | Exit 0; 29 links, zero missing | Registry, matrix and attempt/review evidence; existence only |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 ahead/0 behind before delivery | Actual remote synchronization |
| PostgreSQL fixture count; pg_ctl fast shutdown | Zero fixture databases; exit 0, server stopped | Dedicated synthetic cluster only |

Initial fixture attempts failed because MCP schema errors are plain text and
because a search for IRR also matches Ethiopian Birr; the fixture now handles
SDK error text and selects the exact IRR code. An initial backup test lacked
PG_BIN; the matching client was configured and the final full joint run passed.
The initial bounded numeric factor draft was tightened to reject excess
precision; final migration was regenerated from the committed checkpoint.
These initial attempts are not counted as passed checks. Some discovery probes
used nonexistent paths or PowerShell-incompatible wildcards; corrected without
product impact. No baseline failure was hidden.

## Review and handoff

Honest implementing-agent self-review: [MON-009-review-1](MON-009-review-1.md).
No scoped blocker remains. Complete check/submit/self-review/done, stage owned
files only, commit/push authorized origin/master, verify remote SHA and clean
tree, report the live next task and stop. Actual commit/push SHA belongs to Git
and the final response; no future delivery result is invented here.

No full build, dev server, Docker, browser/screenshot/printer, live rate provider,
hosted CI, deployment, production, independent peer/human or legal review was
performed. Local PostgreSQL 18 does not qualify hosted PostgreSQL 16. Persian UI,
official operational policy, statutory compliance, existing accounting defects,
historical-data remediation and IRR production readiness remain separate gates.
