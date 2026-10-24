# LOC-115 independent whole-website acceptance

Date: 2026-10-24. Agent: codex-task-008. Base: `111c8fce6be6089cb667bac92a0186ad2ef6446c`.

This parent was selected from clean live controller state after LOC-129/130/131/
132/133/134. Their completed status was not treated as parent acceptance. The
current combined source, actual callers, locale/currency adapters, controls,
catalogs and output/technical/provider boundaries were independently audited.

## Source audit and repairs

The final source census is [LOC-115-source-audit.json](LOC-115-source-audit.json):
all 407 app/component TSX files scanned; 208 currency/money lexical candidates
recorded with final SHA-256 hashes and reconciled ownership. Of these, 200 are
adopted/inherited domain/shared surfaces or explicit technical/output exceptions,
three are organization metadata, four are frozen provider/subscription surfaces,
and one is auth-layout currency-feature prose without a monetary unit. Candidate
counts/flags are audit aids, not implementation proof in isolation.

TypeScript AST inspection enumerated ordinary currency-bearing JSX child and
accessibility expressions, imported helpers whose signatures take presentation,
and prefixless CurrencyInput uses. Local wrapper closures, raw identifiers,
formatters, authored examples and actual translation arguments were inspected.
The imported-helper audit found no missing presentation argument; dashboard
closures correctly capture active presentation. The four prefixless inputs are
numeric-only with no implicit unit. Persian catalog leaves containing ISO/$
examples were separately enumerated and reconciled with callers and exceptions.

This independent pass found six missed normal-unit labels and repaired them:

1. OrgSwitcher default-currency info now uses `currencyLabel` and `bdi`.
2. Admin organization list metadata uses the active-language label in `bdi`.
3. Admin organization detail header does likewise, without changing any
   subscription/provider branch, handler, price or provider label.
4. `Journals.accountBalances` Persian fixed-USD label uses دلار.
5. `RecurringInvoices.currencyHint` Persian fixed-USD help uses دلار.
6. `InventoryItems.writeDownAmount` Persian fixed-USD label uses دلار.

English catalog wording and every canonical currency/default/ISO value remain
unchanged. Three catalog leaves change, with no key/count or ICU contract change.

The caller/surface/fallback inventory and remaining explicit exceptions are in
[CURRENCY_UNIT_PRESENTATION.md](../registries/CURRENCY_UNIT_PRESENTATION.md).
Technical FX/reference codes/pairs, import default-USD code help, API/doc examples,
IDs, hidden values, selectors, requests, headers, URLs, CSV/JSON, saved caller data,
issued snapshots and email/PDF output remain their existing machine/output text.
Known authored landing samples localize only their unit marker; ambiguous saved
`$` text is never inferred to be USD. Safe unknown code/prototype/escaped caller
fallbacks are exercised independently of known names.

DEC-008 remains unchanged: dedicated Stripe/provider code; BillingContent; paid
subscription/seat/storage pricing; public checkout page; and the complete mixed
Stripe reconciliation mockup remain frozen. Billing/pricing/checkout byte content
matches HEAD after line-ending normalization. This task does not modify the
mockup or any provider/subscription behavior. Frozen gaps do not block unrelated
currency presentation acceptance.

## Independent automated proof

New `tests/currency-website-acceptance.test.ts` executes real organization shell,
list and header JSX plus OpeningBalanceForm through PresentationProvider/next-intl.
Only page IO/state and established portal/search/animation boundaries are
controlled. It checks both languages with both numeral preferences, literal
ریال, escaped caller text and links, unchanged organization/ISO objects, exact
IRR/USD/JPY/KWD signed/int64 low digits, zero, legacy/payroll fixed-two cents,
hidden canonical input values and unchanged default document money output.

Combined current-source acceptance, 10 files: **42/42 pass**, zero skips/failures,
about 38 seconds:

```powershell
node --import tsx --test --test-concurrency=2 --test-reporter=spec tests/currency-website-acceptance.test.ts tests/currency-labels.test.ts tests/localized-number-presentation.test.ts tests/currency-domain-presentation.test.ts tests/currency-operations-presentation.test.ts tests/currency-remaining-presentation.test.ts tests/dashboard-overview-catalogs.test.ts tests/core-presentation-money.test.ts tests/currency-rollout.test.ts tests/public-output-catalog-integration.test.ts
```

This covers real full/compact picker search and callback values, language/numeral
independence, malformed input rejection, exact controls, financial detail rows,
grouped sums, transfer callbacks, fixed-two operational helpers, dashboard cards/
aging/alerts/forecasts, report query scope, tax settlement, landing samples,
default public output and disabled production IRR qualification. It includes the
first three parent tests, before the subsequent fixed-USD catalog audit addition.

After all three catalog repairs and the fourth parent test, final changed-family
and whole-catalog acceptance: **34/34 pass**, zero skips/failures, about 20 seconds:

```powershell
node --import tsx --test --test-concurrency=2 --test-reporter=spec tests/currency-website-acceptance.test.ts tests/recurring-invoice-catalogs.test.ts tests/inventory-item-catalogs.test.ts tests/whole-catalog-integration.test.ts
```

The standalone final parent suite also passed **4/4**. The two run counts overlap;
they are not summed into a fictitious unique test total. Existing callbacks still
assert canonical ISO/minor/request values separately from presentation.

## Static and invariant gates

- `pnpm typecheck`: exit 0 after all production/catalog/structural test edits.
- Owned ESLint: exit 0; two pre-existing admin-detail unused warnings
  (`ExternalLink`, `effectiveLimits`). No new lint warning is accepted.
- `pnpm lint`: exit 0; 20 pre-existing warnings, zero errors.
- `pnpm i18n:check`: 10,702 keys per locale pass; English catalog unchanged.
- `python .agentic/scripts/money_inventory.py --write` followed by
  `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: 417 columns and
  1,863 final consumer hashes pass. Parsed `schema_columns` exactly equal HEAD;
  all classifications unchanged. The extra consumer is the parent acceptance test.
- `node .agentic/scripts/verify_legacy_money.mjs`: all nine checks pass.
- All 208 audit hashes match final source; owned sources decode strict UTF-8.
- `git diff --check` and structural controller validation pass. Acceptance
  checkboxes/review/done remain separate controller gates, not inferred from
  structural validity.

## Controlled failures and limits

The first new test probe had two harness-only failures: duplicate module identity
in a non-target search control and missing `exports` binding in extracted JSX.
The search field boundary and compile scope were corrected; all final parent
tests pass. Owned lint then rejected a test-local variable named `module`; it was
renamed `compiled` without behavioral changes. This lexical rename is the only
change after the passing test/typecheck runs. Money verification initially saw
that concurrent test-file hash drift; the final inventory was regenerated and
verified after the rename. No failed/intermediate run is claimed as passing.

No full suite/build/dev server, application DB write, schema, migration, REST/MCP
operation or money calculation change occurred. No new business operation was
introduced; existing REST/MCP canonical ISO/Minor services remain the machine
surface. No financial boundary changed, so a new PostgreSQL integration fixture
was not needed. Existing actual-callback/shared-schema/output regressions verify
the relevant unchanged contracts.

This accepts website currency-name adoption and its automated contracts only.
Persian terminology beyond owner-specified ریال remains provisional for L10N-001
and L10N-012. Mounted-browser search/filter/focus/hydration/layout/RTL verification,
native review, hosted/build and production financial qualification remain
independent; browser surfaces were unavailable in this session. No rial/toman
conversion, rounding/scale/FX change or production IRR activation is authorized.
