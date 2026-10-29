# AI-035 self-review 1

2026-10-30, reviewer Codex, self-review. No independent peer/human approval.

Reviewed the actual AI-037/038 composition, original AI-035 criteria, current
focused integration results, independent parent fixture and production diff.
Confirmed real REST/registered MCP/SQL behavior rather than a duplicate executor
or mocked business persistence. Reviewed cumulative limits across clarification,
original pricing, fenced call identities, sensitive-tool exclusion, minimized
context, cancellation/late callbacks and restart without uncertain-write replay.

The new acceptance test exposed success after content expiry during event-lock
waits. The production change rechecks expiry after completion persistence and
authorization waits, rolling back success/message before closing expired. The
same real PostgreSQL lock-wait test failed before and passed after the fix.
Reviewed the catch/reclose path: it reloads the run/conversation and preserves
settled charges and committed business receipts. No new schema, public dispatch,
permission, provider/model fallback or activation was introduced.

Combined tests verify one confirmed exact USD 1250-minor-unit draft, same-run
clarification, REST/MCP idempotency/parity, new lease/stale refusal, stable attempt
associations and original price/deadline/output limits. Original budget increases
cannot reset cumulative admission. Cancellation while a later request is in
flight preserves the confirmed draft, and a late response can settle known
usage without executing its new draft call. Provider narratives/forged URLs do
not become final messages or record links. Broader rerun child fixtures cover
real crash/restart, config/permission/kill/budget/rate failures and raw transport.

Final focused integration group 11/11, protocol 11/11, typecheck, scoped lint,
zero-error full lint, schema/capability/tool drift, locale, legacy money and
controller/diff checks support this integration boundary. The money inventory
remains red with 1447 diagnostics exactly matching clean HEAD. No full-suite,
live-provider, hosting, polling/streaming or rollout qualification is inferred.
No Stripe work, application-DB mutation, build, dev server, deployment or push.

Result: approve AI-035 only. AI-036 and AI-033/031/023/007 retain independent
obligations. Sensitive approval execution remains behind AI-008, and the
documented text-only clarification/automatic-tool boundaries remain explicit.
