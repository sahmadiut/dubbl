# Organization and tax configuration integration (MON-022)

2026-10-09, Asia/Tehran. Parent acceptance of MON-070 through MON-073 under
ADR-006. The four child registries retain detailed field/operation contracts.
This index introduces no operation, unit, serializer switch or statutory rule.

## Boundary inventory

| Boundary | REST / MCP coverage | Inputs, outputs, units and supported range |
|---|---|---|
| Organization GET/PATCH, session list/create, currency and mileage | Seven REST operations and five tools in [organization contracts](ORGANIZATION_WIRE_CONTRACTS.md) | Numeric mileageRate/billApprovalThreshold add matching Minor strings/null. Nonnegative minor units 0..9007199254740991; mileage per mile, dedicated null fallback 67. Threshold has no public writer. Strict settings patches, fiscal start month 1..12; text null clears and omission retains. Currency changes preserve integers and require no journal/payroll history; IRR selection stays gated. Session creation retains name/slug and provisioning defaults. |
| Tax headers/components | Five CRUD pairs in [rate/profile contracts](TAX_RATE_PROFILE_WIRE_CONTRACTS.md) | Numeric rate/component rate 0..2147483647 basis points, recovery share 0..10000; no money/FX aliases. Components reference owned live active accounts. REST full and MCP compact lists intentionally differ. |
| Country profiles | GET/POST tax-profiles; list_tax_profiles/apply_tax_profile | Strict optional country; existing catalogue/recommendation and created/skipped envelopes. Numeric basis points; retries skip matching rates. Catalogue is a stored starting point, not current tax-law guidance. |
| Jurisdiction cache | Three tax-lookup pairs | Exact stored address keys, combined/sub-rates in numeric int32 basis points, no aliases or automatic sum policy. Manual save is an org-locked key upsert. |
| Period metadata/frozen lines | Five CRUD pairs in [period contracts](TAX_PERIOD_WIRE_CONTRACTS.md) | Gregorian date-only ranges, UTC timestamps, open/filed/amended state; frozen line amount/amountMinor. Signed safe integer base minor units. Metadata does not post. |
| Filing | REST file route; file_tax_period/file_vat_return | Optional basis/reference and numeric int32 flatRatePercent basis points. net/outputVat/inputVat plus Minor strings, currencyCode, seven frozen boxes and balanced clearing journal. Legacy MCP compact period ID/status envelope remains distinct. |
| Settlement/refund | REST mode=settle; record_vat_settlement | Nonnegative safe base minor amount/amountMinor with agreement; owned base-currency bank. Optional MCP period linkage preserves standalone calls. Zero is a no-op; repeated positive calls are separate postings. |
| Workflow/steps | Five workflow pairs in [approval contracts](APPROVAL_WIRE_CONTRACTS.md) | Monetary conditions' legacy value is already string; valueMinor adds canonical signed int64 text, -9223372036854775808..9223372036854775807. Compared document currency units, no FX; explicit currencyCode condition can restrict denomination. Member UUID steps and strict merged patches preserve used steps/history. |
| Request reads/actions | Five request/action pairs | Existing request envelopes/public nested member data; tenant/request/document scope and assigned approvers. Invoice/bill lifecycle delegates retained; generic actions only change metadata. Actual document money remains safe-number bounded. |

All 33 configuration MCP tools register exactly once through registerAllTools,
use full strict described schemas and wrapTool with AuthContext, and call shared
direct Drizzle services. Session list/create retain their provisioning boundary.
No tenant ID is a public configuration input. Detailed permissions, defaults,
errors, nullability, field lengths and retry rules remain in the child tables.

## Remaining core configuration

Inspection of schema/auth.ts, organization settings, all API/MCP references and
the money manifest finds two organization monetary settings: mileageRate and
billApprovalThreshold. Their aliases preserve saved integers across USD/IRR/JPY/KWD.
Threshold has no public writer; no policy writer is invented. Opaque approval
conditions are explicitly covered above.

Organization interestRate is numeric basis points, interestGraceDays is days,
interestMethod is a method string, taxLookupEnabled an integer switch, and
taxLookupProvider/taxRegime/vatScheme are strings. These existing read fields
have no writer in the adopted settings schema and gain no monetary aliases.
Unsupported PATCH fields reject. Interest calculation/posting remains MON-019;
profile reads use saved regime/country; filing uses saved scheme or explicit
basis with the existing accrual fallback. No new configuration policy is inferred.

Reports/1099 remain MON-029, contact limits MON-017, document amounts MON-019/020,
claim mileage/expenses MON-021, inventory MON-024, payroll MON-025, assets/loans
MON-026, commercial/project configuration MON-027, recurring/schedules MON-028,
global administration/opaque exports MON-034 and historical remediation MON-033.
Independent financial/migration/security/production gates retain acceptance.

## Combined evidence

configuration-integration.test.ts/worker uses actual API-key auth and all-tools
SDK registration on a migrated disposable database. It composes settings/mileage,
pre-journal currency changes retaining integer 1250, profile apply/retry,
jurisdiction upsert and rates/components with currency-filtered approval.

Legacy numeric major-price REST and exact minor-price MCP invoice submissions
for USD/JPY/KWD both yield subtotal 3000000000, tax 300000000 and total 3300000000.
Rate edits cannot rewrite saved tax. Cross-transport approval/send recognizes
balanced GL; filing freezes net box 5 at 600000000. Two legacy/exact settlements
close output VAT/suspense at zero and move bank by -600000000 in unchanged base
minor units. Identity FX metadata remains exact. Synthetic legacy IRR settings
remain readable/editable at integer 1250 while selection and filing stay gated.

Foreign-ID reads, spoofed headers, denied roles, unknown tenant controls,
invalid aliases and unsupported ranges use SQL-text snapshots across configuration,
documents, numbering, GL and audit. Required-audit faults roll back mileage,
rate/workflow patches, filing boxes/status/journal and linked settlement. Refiling
fails unchanged. This does not invent atomicity for delegated document lifecycles.

Current reruns of organization-settings, tax-rate-contracts, tax-period-contracts
and approval-contracts cover every child operation, numeric/exact safe edges,
six condition operators/int64 thresholds, malformed JSON/history, locks,
concurrency, profiles/defaults and generic actions. Their tracker completion
alone is not used as evidence. Session identity/email seams stay explicit.

## Limits

No full-int64 document/storage cutover, historical currency inference/rescaling,
schema change, configured database migration or IRR production enablement.
PostgreSQL18 fixtures exercise handlers and SDK transport; actual network,
session/OAuth/browser and PostgreSQL16 release qualification remain separate.
Cash/flat-rate/EC heuristics and post-commit best-effort onboarding seeds retain
child contracts. Self-review is not independent accounting/security review or
statutory-tax/deployment approval.
