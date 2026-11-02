# AI-058 self-review

Date: 2026-11-02. Reviewer: Codex, self-review, not independent or human approval.

Reviewed the shared quota/operations service, five REST handlers, five MCP
registrations, lifecycle Stop extraction, capability/coverage registry diff,
contract and integration evidence. Approve this bounded backend child.

Findings resolved:

- Raw PostgreSQL computed timestamps used session-zone strings despite a TS Date
  annotation. Explicit decoding now returns UTC ISO instants; the DB fixture
  runs with an offset timezone and asserts exact reset boundaries.
- Disable authorization must be checked after its configuration row lock;
  Stop also checks after locking and before commit. Actual row-lock waits with
  permission revocation now reject without changing the run/configuration.
- Test cleanup shadowed the outer server variable; corrected and final typecheck
  plus all five integration suites passed.

Verified privacy through explicit run projections and seeded private transcript,
tool, credential and snapshot sentinels. A usage-only custom role reads
organization operations without receiving conversation access and cannot mutate.
Own scope, cross-organization IDs, removed membership and stale MCP closures
fail closed. Stop preserves succeeded steps and uncertain metering; Disable
preserves credentials/history. Exact-version races have one winner and one 409.
Full-scope counts/timing and per-currency costs are SQL aggregates, never sums
of the selected page. Quota data observes current limits, never grants admission.

The full lint gate passes with 20 existing warnings. The money verifier remains
red at 1447 diagnostics; the two precise source/line diagnostic differences
from HEAD are disclosed in attempt evidence. No accounting/schema change or
baseline waiver is claimed. No Stripe work, provider execution or rollout
activation is included. Dashboard/native/browser acceptance remains AI-059 and
AI-011 work; neither parent nor sibling task is completed by this review.
