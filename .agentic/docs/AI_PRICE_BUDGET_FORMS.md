# AI price and budget forms

AI-057, 2026-11-02. Organization `/settings/ai` now includes a separate
price/budget workspace. AI-011 dashboard acceptance remains open.

Prices require `manage:ai-providers` and a currently delegated provider/model.
Budgets require `manage:ai-policy`; member selection uses current organization
members. Each section loads independently and a denied section has no forms.
The existing REST/MCP services enforce current membership and role permissions:

| Form operation | REST | MCP |
|---|---|---|
| Read/create immutable prices | GET/POST `/api/v1/ai/prices` | `list_ai_prices`, `create_ai_price` |
| Read/configure org/member budgets | GET/PUT `/api/v1/ai/budgets` | `list_ai_budgets`, `configure_ai_budget` |

No new operation or MCP tool is required. `usage-input.ts` holds the unchanged
price/budget input schemas for browser and server; `usage.ts` re-exports them
for existing callers. No DB/provider code enters the browser schema module.

Rates are major billing-currency units per million tokens, with up to twelve
whole and six fractional digits. Stored micro-major rates are displayed using
BigInt decimal formatting. Cost ceilings support twelve whole and twelve
fractional digits, while token ceilings support eighteen integer digits. Exact
values never pass through Number. Only bounded rate/concurrency counts do.
The existing localized-decimal parser accepts Latin, Persian or Arabic-Indic
digits with one script per value and validated ASCII/Arabic separators. Mixed
scripts, malformed grouping and excess precision are rejected without rounding.
Explicit currency codes, model IDs and Gregorian verification dates stay canonical.

The UI explains immutable prices, both-budget prerequisites, restrictive zero
and missing budgets, UTC calendar months, per-currency costs, cross-currency
token/rate/concurrency limits, held unknown usage and unchanged prior usage.
It displays the latest 200 price versions with their IDs, rates and evidence.
Saving a price creates a new version; there is no edit/delete price action.
Saving either setting does not perform a provider request or activate rollout.

Each form retains non-secret edits on failure. Saves update only their own
record/section; successful saves do not reload/remount other forms. Budget
scope/currency stay fixed for existing records. Expected versions bind updates;
after a newer version is loaded, users review saved limits and explicitly load
them or keep their entries using that version before another save. Retained
budgets for former members are displayed without an enabled save action.

Pending references fence rapid duplicate submissions. Uncertain network or
unverified saves block another submission until a successful explicit section
reload, with retained entries and a review instruction. No automatic write retry
occurs. Independent section reads and writes validate complete DTO envelopes;
foreign organization rows are rejected. The controller tracks organization and
request generations before and after async work, removes data on revocation,
discards late responses and stops publishing after unmount. Browser focus/storage
events synchronize selection; the app's existing organization switch reloads
the page. Scope changes clear all form instances and caches.

English/Persian JSX, controlled callbacks, exact values and LTR/RTL rendering
are tested through real presentation providers. Inputs have associated labels,
inline validation descriptions and first-invalid-field focus; controls use
logical spacing, minimum 44px heights, wrapping buttons and isolated identifiers.
No browser viewport/zoom, screen-reader, native Persian, live-provider or
production authentication qualification is claimed by these component tests.
AI-058/059 and AI-011 retain operations/dashboard integration acceptance.
