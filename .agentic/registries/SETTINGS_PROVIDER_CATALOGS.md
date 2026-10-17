# Billing and Stripe settings catalogs

LOC-018 is the provider child of LOC-017. LOC-017 was split after inspecting six
settings pages plus the bulk-import wizard: LOC-019 owns document templates and
LOC-020 owns import/export, backups and trash. LOC-017/012/006/002 retain their
independent combined acceptance.

## Extracted scope

| Source | Catalog and preserved behavior |
|---|---|
| `app/(dashboard)/settings/billing/page.tsx` | SettingsBilling: organization/load errors, checkout and portal messages. HTTP requests, redirects, reloads and plan-change state retained. |
| `components/settings/billing-content.tsx` | SettingsBilling: existing free/Pro, monthly/annual, self-hosted, storage/email usage, plan cards, contact and cancellation/renewal branches. Whole seat-count, email-count and dated messages replace English fragments. |
| `app/(dashboard)/settings/integrations/stripe/page.tsx` | SettingsStripe: onboarding, connected-account summary, OAuth/connect/sync/disconnect/mapping messages and confirmation. Existing request bodies, organization headers, OAuth URL keys, history cleanup and refresh timing retained. |
| `components/settings/stripe-integration-card.tsx` | SettingsStripe: sync/disconnect, known statuses, live/test badges, last-sync state, mapping warning and fields. Sync remains disabled until clearing/revenue/fees mappings exist. Account filtering and stored mapping field identities retained. |
| `i18n/provider-presentation.ts` | Exact OAuth code and integration-status allowlists. Unknown URL/status values use reviewed fallback text; arbitrary provider diagnostics use a translated integration-error message. No server prose is used as a catalog key. |

Added 116 paired keys in two namespaces, reaching 1,833 keys per locale.
Persian wording is **provisional** pending native linguistic/financial review.
This does not accept RTL, parent integration or provider availability in Iran.

## Explicit exceptions

| Data/literal | Boundary |
|---|---|
| Stripe, dubbl, Pro, API and OAuth | Provider, product, plan and protocol names retain spelling; surrounding copy is translated. Display names for free/starter/growth/scale are translated independently of their stored IDs. |
| `$`, prices, `B`/`KB`/`MB`/`GB`, storage capacities and numeric usage ratios | Existing provider USD price values and binary storage arithmetic remain unchanged. Technical unit abbreviations retain spelling. Currency/date/numeral adapter adoption is separate work; this task never converts provider prices into organization currency or IRR. |
| Current-period/last-sync timestamps | Existing browser date formatting is retained inside translated complete messages. Preference-aware calendar/timezone adoption belongs to later presentation work. |
| Account names/codes, integration names/labels, masked Stripe account IDs | Caller/provider data remains verbatim and React-escaped. Labels are not treated as built-in status or plan names. Unknown machine statuses use a translated unknown-status fallback. |
| OAuth codes, plan IDs, mapping field IDs, account-type filters, URLs, storage keys and support email | Machine/request identities and routing remain unchanged. Native confirmation receives translated copy; browser-owned dialog buttons remain browser controlled. |
| Arbitrary API/network/provider error prose | Billing/connect failures use operation-specific catalog fallback; known OAuth codes use exact allowlist mapping. Provider integration diagnostics show generic translated guidance instead of raw provider prose. REST/MCP responses remain unchanged. |
| Blank strings, dash and separators | Nonlinguistic values remain unchanged. |

No REST, MCP, domain-service, authorization or schema change. Existing operations
remain in `lib/mcp/tools/integrations.ts`, including `create_billing_checkout`,
`get_stripe_integration_status`, mapping and sync operations. Extraction introduces
no new user operation.

## Verification and limits

`tests/settings-provider-catalogs.test.ts` renders the actual production billing
content and Stripe card through the production presentation provider in both
locales. It checks prices/capacities, thresholds, annual/self-hosted/loaded/error
branches, count messages, escaped caller text, status/OAuth fallbacks and sync
disabling. It also audits bounded JSX and compares actual request ASTs against
pre-extraction request fixtures independent of future Git HEAD.

These are server-rendering, source-contract and behavior assertions, not browser
click, visual-layout, live OAuth, subscription-change or provider-sync acceptance.
No database access was needed. See [attempt evidence](../evidence/LOC-018-attempt-1.md)
and [self-review](../evidence/LOC-018-review-1.md).
