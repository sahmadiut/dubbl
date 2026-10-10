# MON-125 self-review 1

2026-10-10, Asia/Tehran. Reviewer: coding-assistant, kind self. Inspected actual
source diff, registry, disposable REST/full-registry MCP assertions, global
session-handler fixture, parser reuse and verification results. No independent
peer/human approval is claimed.

Findings addressed:

1. Guarding already-decoded jsonb misses numeric-token rounding. Audit reads now
   project SQL text and compare exact decimal keys before JSON.parse; unsafe,
   high-precision and underflow history rejects without rewriting it. Existing
   invoice snapshots reuse the same parser and pass their regression fixture.
2. Admin Number/Boolean coercion could accept invalid quota values or partially
   update controls. Shared strict schemas retain canonical numeric form text and
   empty/null resets, reject objects/exponents/booleans/ranges, and run before
   writes. Raw REST tokens are checked before parsing so a rounded fractional
   token cannot masquerade as an integer. Negative snapshots verify no mutations.
3. Subscription read-then-insert raced on missing rows and partial updates needed
   serialization. Organization locks plus partial conflict upserts preserve
   independent concurrent fields and create one subscription under a first-row
   race. Both actual REST/MCP existing-row and internal session-service first-row
   concurrent fixtures pass.
4. A global site-admin grant must not widen an organization credential. New
   admin API/MCP paths enforce credential/context tenant scope and the database
   site-admin flag; unknown tenant arguments and forged headers cannot widen it.
   Existing session addressing stays global. Fixture authorization includes
   denied custom audit permissions, non-site-admin owners, invalid API keys and
   revoked session-admin flags.
5. Generic guarded JSON would reject legitimate internal plan Infinity values.
   Only known plan-limit sentinels explicitly map to existing null output; money
   and other nonfinite/unsafe values still reject. Admin money aliases retain
   current cents and no currency-based rescale.
6. Audit records are opaque historical data, so names like amount cannot justify
   manufacturing aliases. Existing exact strings remain literal and conflict is
   not interpreted outside the owning domain. The registry accounts for all 30
   schema JSON declarations and leaves original financial/security owners intact.

Final opaque/admin runner (including session worker), snapshot, contact and
organization-settings integrations pass; 364 unit tests, final typecheck and
changed-file lint pass. Full lint has 0 errors/105 pre-existing warnings;
inventory, legacy money gate, controller validation and diff checks pass. Attempt
evidence records precise timing and test limits, including mocked session
resolution, generic audit-row-only preflight and separate parent qualification.

Result: approve MON-125 bounded acceptance. MON-034 integration, MON-126 signing,
MON-127 rendering and independent downstream production qualification remain open.
