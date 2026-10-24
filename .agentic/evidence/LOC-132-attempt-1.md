# LOC-132 - Remaining website currency-unit adoption

## Scope and implementation

Controller selected LOC-132 on clean master at f4e1abd7; LOC-131 and LOC-133 were
done. The caller/exception inventory is in
`.agentic/registries/CURRENCY_UNIT_PRESENTATION.md`, LOC-132 section. The scope
covers report/tax/FX pages and nested renderers, shared budget progress/settlement,
portal invoice/quote/payment/statement views, public signing summary, onboarding
country/review labels and generic authored landing financial illustrations.

Active presentation is explicit at actual owners. Opt-in statement/document
money text keeps the same checked raw currency/amount validation and leaves its
default server/output behavior unchanged. Signing-service fields, issued
snapshots, email/PDF/digest/output APIs and machine exports remain unchanged.
Fixed-two budget units are retained independently of ISO scale. Bank aggregate
numeric bodies remain exact and unbounded by a newly imposed stored int64 limit.
Payment timing keeps its prior ungrouped English decimal body; the localized
body uses the same scale without added grouping. Chart coordinates remain
approximate while exact tooltip/totals use original integers.

Currency names in onboarding and FX presentation never become selected values,
request data, currency pairs, organization headers or storage fields. Saved
reference/caller text remains available and escaped. Existing REST/MCP operations
and canonical ISO/Minor contracts are unchanged; no new endpoint/tool is needed.
No schema or migration change, rial/toman conversion, IRR financial activation,
value rescaling or money calculation change occurred.

## Owner-scope exceptions

DEC-008 is preserved. BillingContent and public subscription pricing are identical
to HEAD, including all seat/storage/annual/monthly/checkout-linked prices. The
entire ReconciliationMockup (mixed Stripe Payout plus sibling bank/journal
samples) is unchanged, including displayed units. The public app/pay token page
is explicitly Stripe checkout/redirect UI and is unchanged, including its money
display. Dedicated Stripe source, routes, cards, tools and provider behavior are
unchanged. These remain inventoried owner-scope exceptions rather than gates on
unrelated website adoption.

Temporary edits to those frozen views were removed after scope review, before
commit. Generic nonprovider hero/report/dashboard/marquee examples alone adopt
`authoredUsdText`; its input is known authored USD text, never user/saved amounts
with ambiguous dollar symbols. Numeric samples, signs, percentages, technical
IDs, dates, graph paths, links and geometry retain their existing behavior.

## Automated proof

Production templates execute through real PresentationProvider/next-intl. Only
page hook state, network IO, animations and established portal/field boundaries
are controlled. New literal tests independently assert Persian rial and int64
low digits, signed report data, escaping, canonical ISO selector callbacks,
organization-scoped query values, settlement preview, portal invoice token URLs
and default output invariance. Generic landing sample assertions use independent
literal expected names; existing callback/mutation/wire tests remain intact.

Final combined affected/composed suite: **117/117 pass**, zero failures, skips or
cancellations, about 79 seconds. Exact command:

```powershell
node --import tsx --test --test-concurrency=2 --test-reporter=spec tests/aging-vendor-report-catalogs.test.ts tests/analytical-report-catalogs.test.ts tests/balance-cash-report-catalogs.test.ts tests/banking-report-catalogs.test.ts tests/custom-report-catalogs.test.ts tests/income-report-catalogs.test.ts tests/ledger-report-catalogs.test.ts tests/tax-report-catalogs.test.ts tests/tax-filing-catalogs.test.ts tests/tax-period-catalogs.test.ts tests/currency-workspace-catalogs.test.ts tests/public-portal-catalogs.test.ts tests/public-signing-catalogs.test.ts tests/public-output-catalog-integration.test.ts tests/landing-features-catalogs.test.ts tests/landing-shell-catalogs.test.ts tests/currency-remaining-presentation.test.ts tests/report-catalog-integration.test.ts tests/tax-catalog-integration.test.ts tests/landing-help-integration.test.ts tests/auth-catalogs.test.ts tests/shell-auth-settings-integration.test.ts tests/operations-catalog-integration.test.ts
```

After that run, the frozen app/pay view was restored and the timing-report decimal
call was tightened to preserve its existing ungrouped English body. The new
literal public invoice proof targets app/portal invoices, not app/pay; no combined
assertion targets the restored provider page. Direct final-source rerun:
**14/14 pass**, zero failed/skipped/cancelled, about 11 seconds:

```powershell
node --import tsx --test --test-reporter=spec --test-concurrency=2 tests/aging-vendor-report-catalogs.test.ts tests/public-portal-catalogs.test.ts tests/currency-remaining-presentation.test.ts
```

Static/guard results:

- `pnpm typecheck`: exit 0. It completed after the latest structural source/test
  edits; the subsequent provider-page pure revert and existing optional grouping
  flag correction are covered by the direct final-source rerun above.
- Owned ESLint: exit 0, four pre-existing unused onboarding type-import warnings
  (Country, BusinessType, Industry, ReferralSource). No new lint errors/warnings.
- `pnpm lint`: exit 0, 20 pre-existing warnings.
- `pnpm i18n:check`: 10,702 paired keys/locale pass; message catalogs unchanged.
- `python .agentic/scripts/money_inventory.py --write` and
  `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: 417 columns,
  1,862 consumer hashes verified after final timing-source correction. Parsed
  schema_columns exactly equal HEAD; every classification is unchanged.
- `node .agentic/scripts/verify_legacy_money.mjs`: all nine checks pass.
- Controller validation: 366 structurally valid tasks. Checklists, honest self
  review and closure are recorded separately; structural validity alone is not
  implementation proof.
- `git diff --check`, owned-file strict UTF-8 decoding and independent Persian
  literal assertions pass. Frozen file hashes and full mixed reconciliation
  function match HEAD. No foreign dirty changes were observed.

## Controlled failures and limits

The first broad run was stopped without a completion claim under memory pressure;
an isolated aging probe timed out, then its isolated production rendering passed.
Initial affected run was 88/95: stale display assertions, direct hook calls outside
the provider and a real omitted shared budget-progress presentation caller were
corrected. Narrow corrected run was 42/43 until embedded authored USD message
pills were adopted, then 47/47. The additional composed run was 24/25 until its
old English budget digit assertion was corrected; final public/shared rerun was
7/7. These failures/intermediate runs are not represented as full passes. The
clean 117 plus final 14 rerun above is the acceptance evidence.

No full test-suite, build or dev server was run. No application DB access.
No replacement hosted CI/build pass or mounted-browser pass is claimed. Browser
surfaces were unavailable in the supervising session. Native linguistic review,
RTL/layout/focus/hydration and IRR production qualification remain independent.
LOC-132 completes only this adoption slice; LOC-115's exhaustive combined parent
acceptance remains open and is the next controller task.
