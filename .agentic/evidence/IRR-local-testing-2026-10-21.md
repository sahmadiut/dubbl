# Temporary local IRR testing

Date: 2026-10-21 (Asia/Tehran). Author: Codex. This records the owner's subsequent
local-testing instruction, not financial qualification or production approval.

## Authorization and implementation

The owner requested, translated from Persian: "Temporarily enable it so I can
test, because my site is not operational." When asked which environment, the
owner explicitly selected "Local development site."

Added server-only `IRR_TESTING_ENABLED`, default off and accepting exactly true
or false. An enabled override requires NODE_ENV=development or test; production,
missing or other runtime names fail closed. The ignored local `.env.local` now
sets IRR_TESTING_ENABLED=true and IRR_PRODUCTION_ENABLED=false. Existing local
configuration is preserved. IRR_FINANCIAL_GATE_PASSED remains false, and even
with the testing override a premature production flag still fails.

The shared REST/MCP selection schema uses the same policy. Settings consumes
the existing currencyRollout.irrEnabled response to enable its IRR option and
show the existing translated restriction only when disabled. Existing billing
permissions and all accounting/payroll/asset/loan/accrual history protections
remain enforced. No organization currency or application financial data was
changed. No commit, push, production deployment, full build or new dev-server
startup was requested or performed. The existing local server remains in use.

The earlier qualification planning evidence remains historical. This local
exception does not complete IRR-001..005, QA tasks, release tasks or human review.

## Verification

- Focused rollout, functional picker, organization wire and settings catalogs:
  21/21 passed, no skips. Includes explicit opt-in/opt-out, exact flag parsing,
  production/missing-runtime rejection, false financial readiness, actual
  shared selection schema, canonical machine values and real settings rendering.
- Migrated organization REST/MCP fixture: 1/1 passed, no skips. Actual handlers
  and linked registered tools successfully select IRR with the local-testing
  flag; independent SQL checks preserve exact 43/1250 minor units. Unauthorized
  selection remains 403 and journal-history currency changes remain 409 through
  both transports, with unchanged snapshots on failure.
- PostgreSQL 18 ran in a fresh OS-temp cluster on 127.0.0.1:55789, with explicit
  TEST_DATABASE_URL/PG_BIN. The randomized fixture database was dropped; admin
  SQL found zero dubbl_ci_* databases and pg_ctl stopped the cluster in finally.
  The application database was not used for fixture writes.
- A direct configuration probe loading local `.env.local` with development
  runtime returned irrEnabled=true and financialGate=false.
- Existing local http://localhost:3000/api/health returned HTTP 200. This is
  availability evidence, not an authenticated browser-selection claim.

Final static checks passed: pnpm exec tsc --noEmit, owned-file ESLint,
pnpm i18n:check (8,855 keys per locale), inventory generation/drift/source
verification (417 columns, 1,821 consumer hashes), all nine legacy-money
regressions and git diff --check. The final rollout-only rerun passed 8/8.
No full-suite or mounted-browser selection claim is made.

Initial expanded checks caught the pre-existing settings test expecting IRR
policy help before that response had been wired to the page; added the missing
policy state/picker wiring. Typecheck also caught Next's readonly NODE_ENV type
in the test harness; scoped test environment mutation through an ordinary
environment record and retained restoration in finally. Successful reruns are
counted above; initial failures are not represented as passes.

## Undo

Set IRR_TESTING_ENABLED=false or remove it from local `.env.local`, then reload
the development server's environment and refresh Settings. This stops new IRR
selections. It does not change any already-created test records or automatically
convert their currency. No production qualification is implied.
