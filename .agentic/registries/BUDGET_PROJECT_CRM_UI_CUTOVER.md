# Budget, project and CRM consumer cutover (MON-157)

Verified 2026-10-13, Asia/Tehran; self-review. This is the MON-008 consumer
slice, independently of the completed domain contracts and MON-007. It does
not close MON-008, enable IRR, widen supported saved values, or change APIs.

## Consumers and boundaries

| Consumers | Read/input/arithmetic boundary | Units and currency |
|---|---|---|
| `app/(dashboard)/accounting/budgets/page.tsx` | `budgetJson` qualifies report aliases; bigint totals, differences and signed rounded percentages; unavailable reports never become zero balances | Signed fixed cents; report's explicit current organization currency. Header-only lists contain no money; only the first ten background reports are loaded, other amounts show unavailable. |
| `accounting/budgets/[id]/layout.tsx` and `page.tsx` | Numeric/exact pairs become bigint before context adoption; bigint line/period totals, variances and ratios; invalid reads clear the view. Recharts uses approximate number geometry with exact bigint payloads for tooltips | Fixed cents, current report organization currency, no historical currency snapshot or conversion. Chart ticks are approximate visual labels. |
| `accounting/budgets/[id]/settings/page.tsx` | Exact signed decimal input and floor/remainder distribution; `totalMinor`/`amountMinor` replacement payloads. Preserve server's explicit-total precedence: initial saved totals need not equal period sums | Two-decimal input independent of ISO scale; negative budgets preserved. Header/date edits keep last exact totals, period edits recompute with bigint. |
| `components/dashboard/budget-progress-bar.tsx` and its `reports/budget-vs-actual/page.tsx` caller | Caller qualifies aliases and converts to bigint; exact fixed-cents display, signed report percentage policy, clamped visual width. Report failure clears rows and shows an alert | Fixed cents with explicit report currency. Other report pages remain separately owned. |
| `projects/page.tsx`, `[id]/project-context.tsx`, `[id]/layout.tsx` and `[id]/page.tsx` | `projectCrmJson` validates saved numeric/Minor pairs recursively, including members, time entries and milestones; exact formatter with saved project currency; bigint aggregate/difference/time arithmetic | Nonnegative fixed cents regardless of saved ISO label. Project-list summary suppresses unlike-currency totals. |
| `projects/[id]/settings/page.tsx`, `members/page.tsx`, `milestones/page.tsx`, `time/page.tsx`, `tasks/page.tsx` | Existing exact rate/amount/hour inputs retained. Scoped nested reads, billing previews and numeric-cents project invoice responses pass `projectCrmJson`. Saved project context qualifies settings/overview consumers | Nullable member rates stay nullable; minutes remain physical int32 minutes, percentages remain percentage numbers. Whole-hour input converts exactly to minutes; rate/minute products retain half-up cents rounding. |
| `crm/page.tsx`, `analytics/page.tsx`, `deals/[id]/layout.tsx`, `activity/page.tsx`; overview/settings inherit validated deal context | `projectCrmJson` qualifies deal values, summary/analytics and stage values before adoption. Existing fixed-cents formatter and bigint weighted value retained | Nonnegative fixed cents with saved currency. Currency selector and server mixed-currency rejection stay intact; probability is nullable whole percent, pagination/stage totals are counts. |
| `components/dashboard/create-drawer.tsx` Project/Deal sections | Existing exact fixed-cents inputs retained; successful returned masters checked before navigation | Project/deal creation retains existing USD defaults; no currency inference from contacts, locale or magnitude. |
| Same drawer's Budget section | Bigint totals/distribution, exact signed draft parsing and Minor-string payloads. Current organization currency is fetched for labels; failed label lookup shows undecorated exact decimal amounts, not an inferred USD currency | Fixed cents without changing saved units. Organization label lookup does not determine input scale. |
| Same drawer's Accrual section | Strict positive exact decimal-major input and canonical whole count; validate successful numeric-cents schedule/period aliases before navigation | REST decimal-major input rounds positive half ties up into fixed cents through 18 decimals; MCP remains integer cents. Period count is 1..1200, not money. |
| Pricing service/consumer boundary | Shared adapter recognizes numeric `unitPrice`/`unitPriceMinor`; actual price resolution and combined project/CRM/pricing regression rerun | Fixed cents, saved price-list currency and existing tier/quantity contracts. No standalone dashboard price-list editor or price-list fetch consumer exists in current source; no new UI is invented. Invoice editors retain their separately qualified document contracts. |

## Validation, drafts and exceptions

Successful scoped reads require canonical Minor strings agreeing with safe
numeric values through +/-9007199254740991. Missing, conflicting, noncanonical,
fractional, unsafe and negative-zero aliases fail before state adoption; negative
project/CRM/pricing values fail. Nullable rates and contact limits require paired
nulls. Signed budget/report values and signed remaining/credit-limit fields retain
their signs. No fallback recovers a rounded numeric amount.

Budget UI uses bigint for derived totals and cancellation, even beyond safe
Number aggregate range. Save checks each amount against the existing coexistence
range; supported signed distribution uses floor division and first-period
remainder, so -1/3 yields [0,0,-1]. Accrual distribution instead retains the
backend's last-period remainder policy; this task does not unify domain policies.

Annual/period editor drafts retain their text separately from the last parsed
amount. Invalid drafts expose `aria-invalid` and block save; a transient minus
does not trigger repeated notifications or silently submit the previous value.
Removing a line reindexes draft keys; changing dates/type explicitly regenerates
periods. Blank amount cells mean zero. Input labels identify line/period controls.

Number remains appropriate for counts, whole minutes, dates, bounded percentage
fields, indices, and chart geometry. Project billing's numeric decimal percent
wire remains unchanged, with existing nine-decimal input qualification. Fixed
two-decimal formatting here is a documented historical domain contract, not a
new ISO-scale claim for JPY/KWD/IRR. Original safe stored values are not rescaled.

## Evidence and limits

`tests/budget-project-crm-ui.test.ts` contains eight behavior/static groups:
signed/safe-max input and distribution, alias rejection, low-digit formatting,
rendered React progress, chart payloads, nested/nullable project/CRM/pricing reads,
accrual ties, invalid draft reindexing, HTTP failures and actual consumer guards.

`tests/integration/budget-project-crm-ui*` uses actual REST/API-key handlers and
linked fully registered MCP in six disposable migrated PostgreSQL workflows:
USD/JPY/KWD, each originated from REST and MCP. Independent SQL-text assertions
retain 3000000001 cents, signed budget periods, negative ledger spend, project
1251-cent rates/30 minutes/626-cent time products, CRM/pricing low digits, and
101-cent accruals from REST 1.005. Cross-transport accrual replay and invalid
budget/deal aliases preserve full scoped snapshots. Existing budget, project,
CRM, billing, pricing and accrual suites retain scope/range/rollback coverage.

`money_inventory.py` maps scoped paths to MON-157 and regenerates source hashes;
19 removed legacy-import allowances prevent their reintroduction. Static
tests protect shared drawer sections without claiming the entire drawer is owned.

No schema/migration, application DB mutation, full build, dev server, Docker,
provider, deployment or production currency flag change. Browser interaction,
independent accounting review, production qualification, full-int64 output and
MON-008 combined acceptance remain separate. DEC-005 does not require screenshots.
