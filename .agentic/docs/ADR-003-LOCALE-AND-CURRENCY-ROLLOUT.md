# ADR-003: locale routing, currency regimes and IRR rollout

Date: 2026-10-02 (Asia/Tehran). CI-002 technical boundary; no financial, native-language or production approval implied.

## Locale and routing

Keep existing URLs and English behavior. LOC-001/002 will add next-intl using request/user preferences without locale prefixes. User preference, organization preference, cookie, header and fallback resolution must be defined there; do not infer currency, calendar or timezone from language. Central exact formatting/parsing and calendar adapters belong to LOC-003/004; RTL primitives to RTL-001/002. Canonical accounting dates stay Gregorian date-only and instants UTC. Persian presentation does not introduce statutory accounting calendars. Email, portal and PDF are separate qualification surfaces. next-intl is not installed by this task.

## Currency regimes

Historical posted amounts must retain the currency/regime interpretation under which they were posted. MON-009 must establish verified minor-unit metadata, provenance, effective dates and explicit regime IDs before a future redenomination is supported. Do not invent an official rate, conversion factor, implementation date or future ISO code. The [currency registry](../registries/CURRENCY_REGIMES.md) remains evidence, not executable policy. Toman UX, new statutory compliance/calendar work, bank-feed connectors and hosting/provider selection remain deferred under DEC-006.

## Executable functional-currency gate

`lib/currency/rollout.ts` owns `IRR_FINANCIAL_GATE_PASSED = false`. This is code-owned readiness, deliberately not an environment boolean or task-tracker lookup. `IRR_PRODUCTION_ENABLED` is a server-only operator request, default false; only the exact strings `true` and `false` are valid when present. Empty, padded, numeric or differently cased flags are configuration errors. `true` is rejected while the code gate is false. No NEXT_PUBLIC variable, request field, user setting, plan override or NODE_ENV can attest readiness. The gate applies in development/test too, so a mislabelled runtime cannot bypass it.

The DB initialization module validates configuration before creating the pool, covering REST, MCP and DB-backed jobs. The shared functional-currency schema normalizes/validates codes and enforces the gate before REST organization updates and MCP `set_organization_currency` writes. REST returns 403 for the rollout error; MCP wrapTool returns an error with status 403. The new tool uses scoped direct DB access, existing manage:billing authorization, journal-activity immutability and audit. Organization creation still accepts name/slug only and gets its existing USD DB default. Site-admin organization PATCH changes subscription fields only. There is no other application writer of organization.defaultCurrency in the inspected source (seed uses USD).

This gate restricts selecting an organization's functional currency. It does not remove ISO reference metadata, mutate existing IRR records, block reads/exports, or certify/block every foreign-currency document or direct SQL writer. Preexisting IRR organizations and foreign-IRR transactions are not made financially safe by this task; qualification and their actual money boundaries remain MON-001..010/QA-001. The production release process must inventory these before any production IRR use. The currency catalog can still show IRR; the server rejection is authoritative. Frontend hiding cannot replace this policy.

## Future enablement and rollback

Keep the code gate false through implementation. MON-010 must supply verified money/FX/currency migration evidence and required actual accounting review; relevant financial/API, security and restore gates plus REL-002 authorization remain mandatory before production use. A reviewed change may then update the code readiness value with evidence for the exact candidate. Tracker completion itself never changes code or environment. Only after that change may an operator set IRR_PRODUCTION_ENABLED=true in an authorized rollout. No endpoint or MCP tool changes these controls.

Set the operator flag false to stop new IRR functional-currency selections. It does not reverse migrations, convert data, change existing organizations or shut off ongoing postings; an operational rollback/freeze plan is required in QA-005/REL-001. Future gates for whole-organization write suspension, cohort rollout or separate previews require their own reviewed policy. This task does not deploy or enable IRR.

Source: [configuration examples](../sources/SOURCE.md#required-configuration-files-resource-examples-and-testing-ready-implementation-details), [security](../sources/SOURCE.md#security-and-privacy), [release policy](RELEASE_GATES.md). Plan sample APP_DEFAULT_CURRENCY and provider flags are not copied into runtime: they are not current Dubbl configuration.
