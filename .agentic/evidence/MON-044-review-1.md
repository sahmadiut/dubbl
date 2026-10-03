# MON-044 self-review 1

2026-10-03 (Asia/Tehran). Reviewer: coding-assistant, the implementing assistant.
This is an actual self-review, not independent peer or human/accounting approval.
Reviewed final source diff, operation/pure fixtures, wire registry, public docs,
manifest and recorded verification. No new scope waiver or production approval.

## Findings and repairs

1. Prior create wrote template and lines separately; generation separately wrote
   invoices/lines/posting/schedule and could duplicate under concurrent runs.
   Shared scoped services and whole-catch-up transactions now use organization-
   then-template locking and existing invoice numbering/posting primitives.
   Concurrent actual DB runs and faults in template/invoice/journal/schedule
   writes, including a failure at the second occurrence, verify rollback.
2. Prior prices hardcoded x100 and generator summed/multiplied Numbers. Shared
   aliases use currency scales and integer-ratio price-first/quantity-hundredths
   arithmetic with safe guards before storage. Pure tests and actual old/exact/
   dual clients validate 0/2/3 scales, signed ties, products/taxes/sums and saved
   unsafe rejection. USD 1250 stays 1250; stored data is never rescaled.
3. Tenant contact/account/tax IDs were not validated; scoped service references
   lock owned rows. Retained history may be read while inactive, but generation
   requires available references. Actual foreign/deleted reference snapshots and
   two-tenant/read-only/type/deleted fixtures fail without mutation.
4. Supplied template FX could otherwise be ignored by generic MCP parsing.
   Explicit unsupported FX fields reach service rejection. Generation instead
   resolves historic FX and saves exact posting snapshots through the reused
   invoice service. Missing FX/locked periods retain the entire catch-up pending.
5. Email previously preceded posting. Auto-send now follows committed recognition;
   deterministic failed-delivery fixture has one failed email log, a sent invoice,
   and no generation on rerun. No durable or exactly-once external delivery claim.
6. Corrected MCP pagination to filter documents/status/frequency before limiting;
   clarified resume catch-up wording and gross preview units. Removed four unused
   variables/imports found by initial targeted lint; final checks are clean.
7. Reviewed the recognition extraction for manual-send behavior: role checking
   remains at sendInvoice, transaction body stays the same, audit follows commit.
   Actual invoice lifecycle and recurring journal integration regressions pass.

## Acceptance and remaining limits

Approve criteria 1 through 3 for the bounded MON-044 slice. Contract registry
covers all adopted REST/MCP/background surfaces and distinguishes numeric major
inputs from stored minor prices and physical quantities. Actual migrated handler/
SDK fixtures demonstrate compatibility, permissions, isolation, atomicity, safe
ranges and error behavior. Full unit suite 134/134, targeted integration/regression
workers, typecheck and lint passed. No changed-file lint warning remains.

The documented behavior change on automatic financial posting failures is
intentional: pending schedule, rather than partial writes or silent draft downgrade.
The user-facing recurring guide explains retry/disable-automation choices.
Full int64, other recurring document domains, cross-writer configuration/lock/FX
coordination, large catch-up performance, creator-loss/system-actor audit policy,
durable external delivery, browser/session/OAuth and production qualification
remain separate tasks. Existing best-effort audit policy is retained. No schema,
IRR rollout, build/dev server, provider or deployment change. MON-019 retains
combined receivable acceptance. Next task: MON-045.
