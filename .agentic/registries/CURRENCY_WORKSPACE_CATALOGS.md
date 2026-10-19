# Currency workspace catalogs

LOC-062 covers `app/(dashboard)/tax/currencies/page.tsx` in full: document title,
loading/ready header, add-currency and add-rate sheets, success/failure feedback,
base-currency card, three counts, unrealized FX report, source labels/tooltips,
currency reference, search, empty states and all count sentences. `TaxCurrencies`
adds 60 paired messages; current catalogs contain 6,102 keys per locale.
Persian financial wording remains provisional pending native review.

## Exceptions and preserved contracts

ISO 4217, currency codes, symbols, caller/reference currency names, document
numbers, IDs and unknown report item types remain escaped data. Known invoice
and bill badges are translated using finite comparisons; type values and React
keys remain canonical. `manual`/`api`, `quote_per_base`, date-only ISO strings,
organization IDs/headers, URLs, HTTP methods, payload field names and defaults
remain unchanged. The reference-table empty-state help now directs users to
retry/contact an administrator, keeping seed-script implementation details out
of the product flow.

Existing numeric/date rendering is preserved as an explicit exception: KPI and
reference badge numbers, en-US rate dates, technical rate placeholder `1.234567`,
input constraints and ASCII rate input. Dedicated localized number/date/input
adapters and complete RTL layout are separate work. Count sentences use ICU
plurals, including decimals, missing quotes and filtered currency totals.
The em dash for an item with no quote remains a nonlinguistic marker.

`taxUiRateInput` still validates positive exact decimals with int32-millionths
coexistence before requests; rates use exact strings and explicit quote direction.
Read-time exact alias checks remain in place. FX report money is validated as
safe integer carriers plus matching canonical Minor strings, then converted to
bigint without rescaling. Null missing-rate amounts stay null. Existing money
formatting, gains/loss signs, default currency, filters, resets and no-org guards
are preserved. No rate retrieval/provider, IRR flag, schema or ledger change.

Mutation failures show complete localized operation messages; untrusted server,
JSON, network and exact-parser prose is never displayed. Currency list failures
are caught with localized feedback and retain existing rows. Currency/rate lists
reject HTTP failures and non-array envelopes before adoption; rate failures keep
their existing list-clearing behavior. Failed organization reads cannot adopt a
base currency. FX failure is stored as a boolean so its message follows the
current locale; invalid reports clear the report and successful retries clear
the error only after exact validation.

## API/MCP ownership

No new operation or REST route is introduced. Existing `list_currencies`,
`list_exchange_rates` and `create_exchange_rate` in `lib/mcp/tools/currencies.ts`
and `unrealized_gains_losses` in `lib/mcp/tools/forecast-fx.ts` remain unchanged,
using AuthContext/wrapTool/direct DB services. The pre-existing global
add-currency action uses `/api/currencies` POST; it has no matching MCP creation
tool in the current source. This extraction preserves that existing surface and
records the parity gap for independent parent acceptance rather than claiming
complete REST/MCP parity. REST authorization and data contracts are untouched.

## Verification and handoff

`tests/currency-workspace-catalogs.test.ts` runs production templates with real
React/next-intl/PresentationProvider and real shared currency picker/loader.
Hooks are controlled; sheet and collapsible bodies are inline for SSR inspection.
This does not qualify mounted-browser, portal behavior or visual layout.

Nine test groups cover both locales, populated/loading/empty/search states,
source labels/tooltips, report missing quotes, escaped caller data, both forms
and busy states. Actual callback bodies execute with controlled IO to verify
exact POST data/direction/date/org scope, successful resets, retry preservation,
no-org/empty guards, HTTP/JSON/network/envelope failures, invalid rate precision,
zero rate, report alias/currency failures, legacy aliases and null/signed amounts.
An AST audit checks authored display extraction, canonical React keys, paired
keys and Persian script. No live REST/MCP/SQL or browser run is claimed.

LOC-028/007/002 retain independent combined acceptance. LOC-063..065 own other
tax surfaces. Native Persian, complete RTL, date/number adapters, statutory,
hosted-CI and production qualification remain separate. Stripe is unchanged
under DEC-008.
