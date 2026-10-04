# Tax rate, profile and lookup contracts (MON-071)

Bounded configuration adoption under MON-022. Rates are dimensionless integer
basis points: 1000 = 10.00%; recovery share 10000 = 100%. They are neither money
nor FX. Legacy and exact clients use the same numeric fields. No rateMinor,
rateExact, amountMinor, currency conversion, negotiation or statutory-rate update
is introduced. Tax periods/filing/settlement remain MON-072; reports/1099 MON-029.

## Operations and envelopes

| REST | MCP | Input and result |
|---|---|---|
| GET /api/v1/tax-rates | list_tax_rates | No input; taxRates array including inactive but excluding deleted rows. REST full headers/components; MCP preserves compact id/name/rate/type/kind/recoverablePercent/isDefault/isActive and component id/name/rate/accountId. |
| GET /api/v1/tax-rates/:id | get_tax_rate | REST id / MCP taxRateId UUID; taxRate full header plus components. |
| POST /api/v1/tax-rates | create_tax_rate | Required name/rate, optional type/kind/recoverablePercent/isDefault/components; taxRate full created header; REST 201. Components retrieved through list/get. |
| PATCH /api/v1/tax-rates/:id | update_tax_rate | id/taxRateId and partial create fields; taxRate updated full header. No patch defaults. |
| DELETE /api/v1/tax-rates/:id | delete_tax_rate | id/taxRateId; success true. Soft deletion clears default, retains components/history. |
| GET /api/v1/tax-profiles | list_tax_profiles | Optional country query/field; supplied returns profile, omitted returns profiles plus recommendedCountry/null. |
| POST /api/v1/tax-profiles | apply_tax_profile | JSON object, optional country; country/regime/taxName/created full headers/skipped name/rate/reason; REST 201 even on repeat. |
| GET /api/v1/tax-lookup | lookup_tax_rate | Required country; optional state/postalCode exact strings; found boolean plus rate/null. Rate contains combinedRate/stateRate/countyRate/cityRate/specialRate/source/country/state/postalCode. |
| POST /api/v1/tax-lookup | save_tax_jurisdiction | Required country/combinedRate; optional state/county/city/postalCode and four sub-rates; jurisdiction full row; REST 201 for insert or update. |
| DELETE /api/v1/tax-lookup?id=UUID | delete_tax_jurisdiction | REST id query / MCP jurisdictionId; success true, hard delete. |

## Supported fields, units and ranges

- rate and component/jurisdiction rates: numeric integer 0..2147483647 (physical
  PostgreSQL int32), including zero. recoverablePercent: 0..10000. No Number
  coercion of strings, fractions, bigint, null, nonfinite/unsafe/out-of-range
  numbers or negative zero in programmatic schemas. DTO guards reject malformed
  stored values with LEGACY_NUMERIC_RANGE/422. Numeric JSON remains lossless
  throughout this bounded range, including explicit exact serialization.
- name/country lookup keys: nonempty strings, up to 10000 characters. Rate type
  sales/purchase/both defaults both; kind standard/blocked/partial_block/exempt/
  reverse_charge/no_vat/sales_tax_us defaults standard. Recovery defaults 10000;
  default flag defaults false. Kind behavior is unchanged, not inferred by wire
  parsing. No new tax calculation or jurisdiction sum policy is invented.
- components: maximum 100; each requires nonempty name and numeric rate, optional
  nullable UUID accountId. Omitted/null account means default control account.
  Provided IDs must be live, active, owned chart accounts. Header rate and
  component rates retain existing independent semantics; no forced sum. On
  patch, omission retains components, [] clears, nonempty replaces all.
- Profile country: two ASCII letters, normalized uppercase; no whitespace.
  Catalogue stays US/GB/ZA/AU/CA/IE/IN/NL with existing rates/return boxes/control
  account codes. Unknown country returns 404 on reads, 400 on apply. Omitted
  country resolves live org countryCode/country and taxRegime, retaining existing
  regime fallback policy. This catalogue is a stored starting point, not current
  tax-law advice or a live rate-provider response.
- Jurisdiction address strings: optional/null, up to 10000 characters; empty
  becomes null on save. Country/state/postal keys remain case-sensitive as stored;
  no normalization that could change existing lookup identity. Optional sub-rates
  reset to 0 on save; combinedRate stays independent. Returned source is cached;
  manual writes store manual. No provider calls or client-controlled source.
- UUIDs must be valid. Strict write bodies and scoped MCP schemas reject unknown
  fields, including monetary/FX aliases and organization overrides. Malformed
  JSON returns 400, including profile apply (previously malformed bodies could
  be treated as an empty apply request). Omitted profile country requires {}.
  Timestamps retain UTC ISO serialization; account codes are identifiers.

## Transactions, scope and compatibility corrections

Actual API-key auth/custom roles and MCP AuthContext scope the shared direct DB
services. Tax-rate reads and profile/lookup reads retain existing authenticated
read access. All explicit rate/profile/jurisdiction writes require
manage:tax-rates; lookup previously allowed any authenticated writer. Foreign,
missing, deleted rate IDs and invalid component references return 404 without
mutation. Permission/auth failures remain 403/401; schema failures 400. MCP
wrapTool supplies the standard error envelope. No posted-history or period-lock
operation occurs in this configuration slice; filing/settlement locks stay assigned.

All adopted writers lock the live organization row before touching configuration.
Compound replacement, default clearing, header updates and required audits commit
together. Reference rows are share-locked during rate writes. Omitted fields
retain values. Existing invalid numeric headers/components fail before patch
mutation. Component references are rechecked on patches, including retained ones.
Reads return saved IDs without loading foreign chart-account data.

Concurrent profile applies skip matches by normalized name/rate/type/kind under
the same org lock. Existing chosen default is preserved; at most one newly
created default is selected. Skipped matching rates are not edited or promoted.
Retries return created=[] with skip reasons. Entire batch and audit roll back
on failure. Audit entity_id uses org UUID; country remains in changes (the former
country-as-UUID best-effort audit could fail). Organization settings pass actor
context into their existing post-commit best-effort tax seed call.

Rate list retains REST's best-effort empty-list profile seeding, now shared with
MCP; read-only callers retain that existing REST capability. Seed failure leaves
the list readable, with no partial seed. Each successful seed has an actor audit.
It does not set org tax regime or create chart control accounts.

Jurisdiction save locks org, explicitly matches NULL state/postal keys, and updates
or inserts atomically, fixing ordinary PostgreSQL unique-index NULL duplication.
Existing duplicate historical keys are not rewritten; latest updated row then
UUID selects one deterministically. Lookup omitted filters retain the previous
any-match behavior with deterministic ordering. No timestamp or numeric field is
rounded. Write audit failure rolls back cache/default/component/profile changes.
No generic request-idempotency key is added to rate creates: repeating one creates
another rate; profile apply and jurisdiction key upserts have their stated retry
semantics. Writers outside this adopted configuration set are not qualified here.

## Evidence and limits

Four unit groups and actual REST handlers/registered MCP SDK calls run against a
fresh migrated disposable PostgreSQL18 database. Two organizations, custom-role
permissions, invalid/expired keys, spoofed tenant headers, max int32, unsupported
aliases/body/numeric input, stored invalid numbers, component isolation, retained
patches/replacement, concurrent defaults/profile applies/NULL-key upserts and audit
rollback use real DB assertions and SQL snapshots. Adjacent organization-settings
and bank-rule PostgreSQL regressions pass. See MON-071 attempt/review evidence.
No genuine session/OAuth/browser/provider/current-law/PostgreSQL16/independent
human qualification or deployment is claimed. Schema/storage/currency/IRR flags
remain unchanged. Historical invalid or duplicate data remediation is separate.
