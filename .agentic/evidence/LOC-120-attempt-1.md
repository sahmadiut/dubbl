# LOC-120 evidence - 2026-10-23

Started from clean master. Split broad LOC-009 into LOC-120..124 after inspecting
app/sign, app/pay, app/portal, components/landing, lib/email, lib/documents and
trigger ownership. Only LOC-120 is completed in this delivery.

Implemented 23 paired PublicSigning messages in the actual server page/client
canvas. Reviewed generic HTTP errors replace unreviewed response prose. Request
shape, authorization, persisted data, money and Stripe remain unchanged.
Exceptions are inventoried in registries/PUBLIC_SIGNING_CATALOGS.md.

Verification (all exit 0):
- node --import tsx --test tests/public-signing-catalogs.test.ts: 3 tests; real
  bilingual templates/provider, escaped user data, status branches, opaque money
  and dates; production submission body executed for success/HTTP/network/JSON.
- node --import tsx --test tests/integration/invoice-signatures.test.ts: 1 suite;
  actual signing REST/SSR/full SDK MCP and SQL, scope/status/expiry guards, exact
  and legacy money, SMTP rollback and signature/snapshot races. Only locale
  request boundary and SMTP are controlled. SSR now uses PresentationProvider.
- pnpm i18n:check: 9,683 matching keys per locale, valid ICU contracts.
- pnpm typecheck and final npx tsc --noEmit.
- pnpm lint: zero errors, 21 existing warnings outside owned source.
- npx eslint 'app/sign/**/*.tsx' tests/public-signing-catalogs.test.ts
  tests/integration/invoice-signatures-worker.ts: zero errors/warnings.
- python .agentic/scripts/money_inventory.py --write; node --import tsx
  .agentic/scripts/verify_money_inventory.mjs: 417 columns, 1,841 consumers.
- node .agentic/scripts/verify_legacy_money.mjs: 9 checks pass.
- python .agentic/agent.py validate and git diff --check.

Integration used unique OS-temp PostgreSQL 18 cluster, explicit UTF8/trust,
127.0.0.1:57824 and process-scoped TEST_DATABASE_URL/PG_BIN; fixtures create/drop
random databases. pg_ctl stopped the cluster in finally. No application DB used.

Initial Python text piped through PowerShell lost Persian characters; repaired
via a UTF8 patch-written script, removed it and asserted Persian script in every
new value. Initial canvas render harness loaded a separate next-intl instance;
sharing the real imported module fixed provider identity. Money inventory's
initial source drift was resolved by the standard generator and verifier.

No full build, dev server, browser qualification, actual SMTP delivery, hosted CI,
native Persian approval or deployment is claimed. Parent LOC-009/LOC-002 and
remaining children stay open. Honest self-review only.
