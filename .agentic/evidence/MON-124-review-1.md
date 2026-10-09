# MON-124 review 1

2026-10-10, Asia/Tehran. Reviewer: codex, **self-review**. Inspected actual shared
wire/service, REST/MCP adapters, fixture assertions, registry, source inventory,
task split and verification results. No independent peer/human review claimed.

Findings addressed:

1. Old REST/MCP schemas stripped unknown fields and diverged on empty/name input.
   Both now use described strict objects with real SDK negative fixtures. Shared
   service checks authorization and owned live ID before exposure or mutation.
2. Serializing decoded jsonb cannot detect decimal loss introduced by pg. SQL-text
   numeric token preflight now compares exact decimal coefficient/exponent keys
   before parsing. SQL-seeded high-precision safe-range decimals reject; escaped
   digit strings, tiny exact strings and supported numeric decimals remain intact.
3. Unlocked snapshot merges lost concurrent corrections and could edit signed
   history. Scoped invoice/signature row locks preserve merges and reject signed
   history, with a real held-signing-lock fixture proving the wait/recheck.
4. Invoice-first locks before audit parent FK acquisition could conflict with
   organization-first lifecycle writers. Corrected ordering; a held organization
   fixture can acquire the invoice with NOWAIT while correction waits upstream.
5. A response-only JSON guard or best-effort audit could fail after persistence.
   The complete result is preflighted before update, and an awaited transaction
   audit rolls back everything on failure. Both transport rollback fixtures pass.

Actual final integration 1/1, final typecheck and changed-file lint passed; unit
suite 364/364 and full lint 0 errors/105 unchanged-file warnings also passed with
the timing limits accurately stated in attempt evidence. Money inventory/gates,
controller validation and diff whitespace checks passed.

Approved for the bounded MON-124 criteria. Party snapshots are not financial
amount consumers and their opaque string fields do not gain aliases or rescaling.
Unsupported history stays stored unchanged. The remaining opaque/admin/signing/
SSR/PDF work and MON-034 final integration stay open. No production, live provider,
large-history performance, full-int64 ledger or independent accounting approval.
