# MON-158 report, contact and dashboard combined acceptance

Independent integration acceptance joins MON-161, MON-162 and MON-163. This
supersedes their MON-158-pending notes; MON-008 retains its own acceptance.
Existing runtime adapters, org-scoped direct-DB MCP registrations and shared
services compose without new public operations or schema/migration changes.

## Complete scoped ownership

| Consumers | Contract, units and detailed ownership |
|---|---|
| Six financial statement pages, including comparative balance sheet | [MON-161 mapping](FINANCIAL_STATEMENT_UI_CUTOVER.md): fixed-two decimal or numeric aliases validate against canonical Minor strings; explicit report currency controls display; bigint sums/comparisons and raw-Minor CSV |
| All remaining report pages | [MON-162 mapping](AUXILIARY_REPORT_UI_ACCEPTANCE.md): 22 child result consumers, existing budget consumer, and three navigation/configuration/download pages; maps all 32 report pages together with the six statements |
| Contact list, layout, detail, bookkeeping, activity and statement | [MON-163 mapping](CONTACT_DASHBOARD_UI_CUTOVER.md): saved credit limits, document-currency balances, signed movements and per-row activity currencies; matching aliases required before adoption |
| Auxiliary dashboard widgets, cash forecast and shared statement/export display | [MON-163 mapping](CONTACT_DASHBOARD_UI_CUTOVER.md): existing statement/aging/budget adapters, exact alert thresholds and original chart tooltip integers; core journal dashboard remains MON-007 |

The linked mappings account for every scoped page/helper and existing REST/MCP
contract. Invalid HTTP/JSON, missing/conflicting/unsafe/noncanonical aliases,
invalid currencies and inconsistent derived totals suppress successful financial
state/output. Existing cleanup/version guards reject superseded requests.
Shared components and English controls remain intact; DEC-005 permits
behavioral/static review without screenshots.

## Independent combined assertions

[Parent fixture](../../tests/integration/report-contact-cutover-acceptance.test.ts)
and [worker](../../tests/integration/report-contact-cutover-acceptance-worker.ts)
create separate USD, JPY, KWD and synthetic IRR tenants with the same literal
4000000003 revenue and 907 expense in posted journals and outstanding documents.
The dates follow the UTC current month so monthly dashboard trends and forecasts
read this same history. Currency history is never relabeled or rescaled.

Literal SQL text independently verifies cash net 3999999096, receivable
4000000003, payable 907 and maximum-safe contact credit limit 9007199254740991.
Eleven authenticated REST/linked SDK registered MCP pairs adopt the actual UI
adapters: PnL, balance sheet, general ledger, cash flow, receivable aging,
tracking, forecast, monthly trends, dashboard alerts, contact statement and
contact activity. Contact detail additionally checks REST/MCP parity; contact
list balances reconcile its documented richer REST envelope. MCP list_contacts
does not return balance aggregates and is not represented as that operation.

Assertions join statement net income, asset/earnings balances, ledger cash,
tracking/cash-flow totals, contact debit/credit/closing balance, forecast
inflows/outflows/net and trend net. Activity retains document amounts and
currencies; credit-limit scale input round-trips all digits. CSV preserves raw
integer strings and display applies only the declared currency scale. Repeated
reads, malformed adoption, unauthorized REST, denied MCP and foreign contact
IDs preserve full ordered SQL JSON-text financial/audit snapshots. API-key
usage metadata is excluded from those financial snapshots.

Balanced persisted ledger overflow plus a maximum-safe extra invoice makes
nine report/contact/forecast operations return REST 422 and MCP
LEGACY_NUMERIC_RANGE; HTTP adoption fails and contact-list overflow also rejects.
History remains unchanged by successful or failed reads. Existing child/domain
fixtures jointly cover cumulative/period comparisons, historical FX, tax,
consolidation, custom reports, bank reports, dashboard policies and exports.

## Preserved units and independent limits

- Required wire carriers retain the numeric safe-integer range; derived UI sums
  use bigint. Full-int64 business operations remain separate.
- Statement decimal aliases are fixed-two projections of saved raw units,
  independently of ISO scale. USD 1250 stays 1250; JPY/IRR display zero decimals,
  KWD three. Budget cents and recurring forecast line-extension policies remain
  their existing documented exceptions.
- No cross-currency client sum/FX, history rescaling or production IRR enablement.
  Contact activity currencies stay per-row; statement/forecast filters select
  document currencies. Backend ledger reports retain current-base/raw-history
  conventions. Consolidation entity values remain pre-elimination.
- Counts, quantities, dates, periods, percentages and ratios retain their units.
  Chart geometry alone is approximate; tooltips use exact integers. Raw-Minor
  CSV stays text; numeric XLSX retains its decimal and 15-digit precision guards.
- The existing natural-sign trial-balance accounting defect remains assigned to
  PAR-008/QA-001. MON-008, migration, localization/native wording, accounting,
  security and release gates remain independent.
- No live browser, print/download, hosted CI, independent peer/human review,
  provider, Docker, deployment or production qualification is claimed.

See [verification matrix](../docs/TEST_MATRIX.md),
[money manifest](MONEY_MANIFEST.md) and [money README](../../lib/money/README.md).
Generated MONEY_BOUNDARIES retains child runtime ownership and current hashes.
