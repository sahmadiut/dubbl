# LOC-001 self-review 1

2026-10-17 (Asia/Tehran), coding-assistant, self-review of the task diff and
[attempt evidence](LOC-001-attempt-1.md). This is the implementing assistant's
review, not independent peer, human, linguistic or browser approval.

Reviewed preference precedence/validation, Next plugin composition, request cache,
client provider payload, auth transitions, every activeOrgId writer, REST/MCP
registration and shared service, role/tenant/user scope, audit, additive migration,
fixture assertions and money inventory changes.

Findings addressed before submission:

- Client-only auth navigation can retain the root's guest configuration. Changed
  successful credential auth/sign-up/invitation transitions to document navigation;
  same-origin callback paths/query/hash are covered, and proxy/auth URLs remain.
- Existing localStorage-only org selection needs to reach server locale resolution.
  Mirrored each existing selection writer, validated membership before reading a
  default, migrated old selections before dashboard content, and guarded blocked
  cookies against reload loops.
- A user with one live membership can resolve its default without a selection
  cookie. Added that case while preserving explicit-selection checks and avoiding
  guesses between multiple organizations; verified in the migrated fixture.
- Corrected lint errors and test harness assumptions. Final relevant tests pass.

No unresolved blocking issue found. Writes cannot choose another user or currency;
unknown fields and unsupported preferences fail before mutation. Organization
defaults retain existing manage:billing/audit policy. User update and audit are
transactional, and stale MCP membership is rejected. Migration is additive and
old-row/money preservation has independent SQL assertions. Request configuration
does not infer timezone/currency from Persian, and provider inputs are explicit.

Limits are accurately recorded: provider serialization/render equality was tested,
not live-browser hydration or visual layout. Next build/dev were prohibited and
not run. Native Persian review, broad catalog extraction, global numeral/calendar
adapter adoption and RTL remain later tasks. These are not claimed complete.

Disposition: approve self-review for LOC-001 after the recorded verification.
