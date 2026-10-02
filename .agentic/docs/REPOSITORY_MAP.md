# Verified repository map

Inspected 2026-10-02 for AUD-001. Source/configuration baseline, not production qualification. Evidence: `../evidence/AUD-001-attempt-1.md`.

| Fact | Verified value | Evidence |
|---|---|---|
| Repository root | `D:\Projects\dubbl` | Git/local inspection |
| Fork HEAD / branch | `f30f34aa55fe316a5e4ab79cdb70c9f61f6d5840` / master | `git rev-parse HEAD`, `git branch --show-current` |
| Upstream URL / baseline SHA | `https://github.com/dubbl-org/dubbl.git`, local upstream/master `13c3cf14e7900d32ad0ee8081c385e404dc120f9` | Local refs only; no fetch/freshness claim |
| Existing user changes | Clean at entry; fork 0 behind/1 ahead, only 99 added `.agentic/` files | git status, local upstream diff |
| Package manager / lockfile | pnpm@10.30.3 declared; pnpm-lock.yaml and package-lock.json both present; Docker/CI use frozen pnpm installs | package.json, Dockerfile, `.github/workflows/ci.yml` |
| Runtime / database versions | Next 16.1.6, React ^19.2.4, TS ^5; CI/Docker Node 22, Compose PostgreSQL 16 Alpine | Manifest/configuration; running DB not queried |
| Local tooling | Node 23.11.0, npm 11.3.0, pnpm 10.30.3, Python 3.13.9 | Version commands; differs from CI Node 22 |
| Development / build / typecheck / lint | next dev/build/start through manifest; `npx tsc --noEmit`, `npm run lint` | Commands below; full builds and unrequested dev prohibited by AGENTS |
| Unit / integration / E2E commands | `npm test`: Node test runner with tsx over eight tests/*.test.ts files; no DB/browser E2E script in manifest | 44 pure-function tests passed; not workflow qualification |
| Schema / migrations / ledger | `lib/db/schema/index.ts`, bookkeeping/invoicing/banking schemas; `drizzle/0000_baseline.sql` through `0004_faithful_paper_doll.sql` | drizzle.config.ts, drizzle/meta/_journal.json |
| API / MCP | 520 files under app/api/v1; 55 under lib/mcp/tools, registered in index.ts; AuthContext at server creation | lib/api/auth-context.ts, lib/mcp/server.ts, lib/mcp/errors.ts |
| Locale / UI / PDF / jobs | app/, components/, Tailwind 4; app/layout.tsx hardcodes English/Latin fonts without root direction; lib/documents/pdf-generator.ts, pdf-renderer.tsx; trigger/ | Inspected source; no next-intl dependency, Persian completeness unverified |
| Deployment and feature flags | Next standalone, Docker, Railway /api/health, Trigger config; production IRR gate not established | next.config.ts, Dockerfile, railway.json, trigger.config.ts |
| Previous implementation evidence | Existing currency helpers, balanced FX legs, bank rules/matching, warehouse transfers, payment links, period locks | Capability inventory below; runtime differences from local upstream are absent |

Do not run example application commands from the plan blindly. Record command working directory, prerequisites and observed outcome; preserve any baseline failure. Do not paste environment secrets or credential-bearing remotes.

## Commands and coverage

All commands use the repository root. Installed dependencies and ignored generated `.source/`/`.next/` output were already present. No clean-install reproducibility claim is made.

| Command | Definition / prerequisites | Audit result |
|---|---|---|
| `npm run lint` / `pnpm lint` | eslint | npm form executed; final result in evidence |
| `npx tsc --noEmit` / `pnpm tsc --noEmit` | Local TypeScript; CI first runs `pnpm fumadocs-mdx` | npx form passed; generated sources existed; tsconfig excludes scripts/ |
| `npm test` / `pnpm test` | `node --import tsx --test tests/*.test.ts` | 44 passed after sandbox escalation |
| `python .agentic/agent.py validate/status/context` | Offline Python controller | Passed |
| `python -m unittest discover -s .agentic/tests -v` | Temporary backlog copies; one symlink test needs Windows privilege | 26 run, 15 failures, 1 error while AUD-001 active; evidence explains |
| `pnpm dev/build/start` | next dev/build/start | Inspected only; AGENTS prohibits full builds and dev without explicit request |
| `pnpm db:generate` | drizzle-kit generate | Inspected only; no schema edits made |
| `pnpm db:migrate` | tsx scripts/db-migrate.ts, DATABASE_URL; adopts preexisting baseline when applicable | Inspected only; DB mutation not performed |
| `pnpm db:push/seed/studio` | Drizzle push, tsx seed with .env, Drizzle Studio | Inspected only; never push in production |
| `pnpm trigger:dev/deploy` | Trigger CLI and configured project/credentials | Inspected only; no deployment/jobs run |

CI has lint, typecheck, test, build, Docker, PR migration drift and master migration jobs. Build/Docker/migrate depend on lint/typecheck, not test. README advertises Node 20+/PostgreSQL 15+; concrete Docker/Compose selection is Node 22/PostgreSQL 16. S3-compatible storage is implemented in lib/s3.ts; credentials were not read.

## Existing capabilities to preserve

Source presence does not establish defect-free workflows. Pure tests do not qualify DB transactions, authorization or UI behavior.

| Capability | Existing paths | Test evidence |
|---|---|---|
| Minor-unit formatting and currency metadata | lib/money.ts, lib/currency/iso4217.ts | tests/money.test.ts, iso4217.test.ts |
| Balanced FX posting, settlement, revaluation, rate status/triangulation | lib/currency/convert-entry.ts, converter.ts, rate-status.ts, triangulate.ts | convert-entry, settlement, revaluation, rate-status, triangulate test files |
| Bank account-code allocation | lib/api/bank-ledger-codes.ts, bank-ledger.ts | tests/bank-ledger-codes.test.ts |
| Bank rules/matching | lib/api/bank-rules.ts, bank-auto-reconcile.ts, lib/banking/reconciliation-matcher.ts; app/api/v1/bank-rules/route.ts, bank-transactions/[id]/match/route.ts; MCP bank-rules.ts/bank-transactions.ts | No workflow tests in suite |
| Warehouse transfers | app/api/v1/inventory/transfers/route.ts, [id]/complete/route.ts; app/(dashboard)/inventory/transfers/page.tsx; MCP inventory.ts/warehouses.ts | No workflow tests in suite |
| Payment links/portal | app/api/v1/invoices/[id]/payment-link/route.ts, app/pay/[token]/page.tsx, app/api/pay/[token]/checkout/route.ts, app/portal/[token]/ | No provider/public-route tests in suite |
| Period locks/fiscal closure | lib/api/period-lock.ts, period-close.ts, app/api/v1/period-lock/route.ts, lib/mcp/tools/period-close.ts | No lock/authorization tests in suite |
| Other domain surfaces | lib/db/schema/, REST v1 and MCP registration include invoices, bills, expenses, payroll, projects, CRM, inventory, reports | Presence only; later parity audit required |

Money hardening remains unfinished: ledger debits/credits, document totals and banking balances inspected in schemas use PostgreSQL integer; FX is integer millionths. lib/money.ts uses parseFloat/Number/Math.round; converter.ts multiplies Numbers and rounds inverse rates. Existing currency-aware helpers/passing tests do not establish bigint or exact-decimal safety. Preserve legacy cents contracts pending compatibility work.

Local .env, dependencies and generated artifacts exist but are ignored; environment secrets were not opened. LICENSE is present (Apache-2.0); complete notice/provenance review belongs to AUD-003. Latest online upstream, production configuration, DB/migration behavior, rendered UI/PDF and providers remain unverified.
