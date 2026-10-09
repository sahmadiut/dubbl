# Organization settings wire contracts (MON-070)

2026-10-04, Asia/Tehran. ADR-006 additive compatibility; bounded safe-number
domain. MON-022 retains combined organization/tax/approval acceptance after
MON-070 through MON-073. No schema, stored-unit, currency flag or tax-policy change.

## Operations and envelopes

| REST | MCP | Input / result | Permission |
|---|---|---|---|
| GET /organization with org header or dk_ API key | get_organization | `{organization}`; current live authenticated organization | Authenticated member/advisor/key context |
| GET /organization without header/key | Existing session provisioning UI | `{organizations}` from current user's live memberships, including role/memberCount | Session user |
| POST /organization | Existing session provisioning UI | Strict `{name,slug}`; 201 `{organization}`; settings defaults and exact aliases | Session user, existing site creation policy and plan limits |
| PATCH /organization | update_organization | Strict partial settings; `{organization}` | manage:billing; view:data for onboardingCompleted alone |
| PATCH /organization with defaultCurrency | set_organization_currency | REST defaultCurrency / MCP currencyCode (ISO code); `{organization}` | manage:billing; no journal/payroll/asset/category/loan history; IRR gate |
| GET /organization/mileage-rate | get_organization_mileage_rate | `{mileageRate,mileageRateMinor,currencyCode}` | Authenticated context |
| PUT /organization/mileage-rate | update_organization_mileage_rate | Strict numeric/exact mileage aliases; same envelope as GET | manage:tax-config |

Organization tools are direct Drizzle services registered by the existing
registerOrganizationTools/registerAllTools path and use wrapTool. They operate
on the supplied AuthContext; no arbitrary organization selection or cross-org
provisioning tool is introduced. Session identity and outbound email are fixture
boundaries in tests, not genuine session/OAuth/email qualification. Site-admin
organization/subscription responses are global configuration/opaque boundaries
for MON-028/MON-034, outside these member-scoped operations.

## Money and controls

- Organization responses preserve numeric mileageRate and billApprovalThreshold,
  adding mileageRateMinor and billApprovalThresholdMinor canonical ASCII strings.
  Both saved fields can be null; aliases stay null. Threshold currently has no
  public configuration writer, and no new threshold rule is introduced.
- Mileage is organization functional-currency minor units per **mile** (USD
  cents per mile). GET's saved-null fallback remains 67, with alias "67" and
  explicit currencyCode. General organization responses preserve the actual null.
  USD/JPY/KWD/IRR 1250 remains integer 1250; no multiplication by display scale.
- Write mileageRate is a nonnegative safe integer Number; mileageRateMinor is
  a canonical nonnegative signed-int64 string. At least one is required; dual
  values must agree exactly. Effective supported range is 0..9007199254740991.
  Larger valid int64 strings fail 422 LEGACY_NUMERIC_RANGE before transaction;
  malformed/out-of-int64, negative, fractional, localized, exponent, whitespace,
  leading-zero, negative-zero and conflicting aliases fail 400. No partial parse.
- Saved unsupported money/currency fails 422; the transitional ORM rejects
  above-safe-range bigint text before decoding. Unsafe untouched fields prevent
  settings writes. Safe malformed mileage may be repaired by its dedicated PUT;
  above-safe historical ORM values still require the separate remediation gate.
- defaultCurrency is an ISO functional currency; input normalization is explicit.
  Existing journal activity (including draft/deleted rows, preserving prior
  policy), payroll runs, assets, asset categories, loans or accrual schedules reject a changed value
  with 409. Asset/category/loan history includes unposted and soft-deleted roots
  because their amounts have no currency snapshots. Their writers serialize on
  the same organization lock; same-currency metadata edits remain allowed. See
  [MON-026 integration](ASSET_LOAN_INTEGRATION_CONTRACTS.md). Accrual schedules also
  have no currency snapshot; unposted and cancelled history freezes currency
  under the same organization lock as schedule creation/posting/cancellation.
  See [MON-028 integration](CONSOLIDATION_AUXILIARY_INTEGRATION_CONTRACTS.md).
  IRR selection remains 403 even
  though synthetic legacy IRR rows are readable. Changing an empty org's
  currency never converts saved settings. Settings have no historical currency
  snapshot; this feature does not infer one or qualify cross-currency claims.
- Interest rate, tax basis/recovery rates, lookup switches and grace days are
  numeric controls, not money or FX; no *Minor alias is attached. Their writers
  remain in assigned tax/opaque domains. Fiscal start month is integer 1..12.
- PATCH supports the existing name, slug, country/countryCode, business type,
  fiscal start, registration/address/contact/payment-term/industry/referral and
  onboarding fields. It also persists peppolId/peppolScheme already submitted
  by the settings UI (previously silently stripped). Text nulls clear fields;
  omitted fields stay unchanged. Country/business type is validated against
  the merged row when either country or type changes. Unknown fields reject,
  including unsupported monetary fields; no false successful exact update.

## Atomicity and preserved behavior

Organization-scoped SELECT FOR UPDATE serializes partial settings/mileage writes
and currency changes. The candidate and returned DTO are validated before commit;
awaited audit shares the write transaction, records actual actor/organization and
request IP/user agent, and rolls back on failure. Creation validates DTO and audits
within organization/membership/subscription provisioning. API key organization
wins over spoofed headers; missing/deleted primary organizations return 404 without
decoding foreign money. Reads preserve Date serialization and safe numeric fields.

First-country onboarding continues the existing idempotent chart/tax-profile
seeding after settings commit; tax seeding remains best-effort. This is not an
atomic multi-domain seed operation or its race/fault qualification. Account and
tax lists retain their self-healing behavior. Provisioning email is unchanged;
tests stub outbound delivery. Settings do not post journals and do not invoke a
period lock; claim/journal posting retains its own period and FX guards.

## Evidence

organization-wire.test.ts covers scales/nulls/safe bigint DTOs/strict aliases and
controls. organization-settings-worker.ts exercises exported REST handlers and
all five registered SDK MCP tools (also registerAllTools), migrated disposable
PostgreSQL, numeric/exact/dual clients, four scales, API keys/custom permissions,
spoofed tenant headers, session-list/create with stubbed identity/email, history
gates, malformed/unsafe saved values, partial update races, PEPPOL persistence,
onboarding seeding and injected audit faults with SQL-text snapshots.

No full-int64 business cutover, live session/OAuth/provider/email, browser,
PostgreSQL16, historical currency remediation, independent accounting/security,
deployment or IRR production qualification is claimed.
