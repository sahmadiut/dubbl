# LOC-042 self-review 1

Date: 2026-10-18. Reviewer: coding-assistant (Codex), the implementer. Kind:
self-review; no separate peer, human, native linguistic or RTL approval claimed.

Disposition: approve the bounded extraction. No unresolved finding blocks
LOC-042. [Attempt evidence](LOC-042-attempt-1.md) records actual results.

- Reviewed owned receipt list/detail, drawer, money details, attachments,
  status helper, paired catalogs, tests and mechanical money inventory refresh.
  All 92 new keys have Persian-script content and compatible ICU arguments;
  previous namespaces and other drawers match HEAD, including Stripe.
- English labels and amount presentation are retained. Count sentences now use
  ICU plurals. Status mapping checks own properties; unknown/prototype-like
  status codes remain data. Rendered names, references, notes, descriptions and
  file names are escaped in both locales.
- Reviewed initial/detail/list-more read paths and the original callbacks.
  Failure cases cover HTTP denial, network, invalid JSON/shapes and money aliases;
  reads do not adopt bad amounts, cancelled reads do not update state, pagination
  preserves earlier rows and stale generation results are suppressed.
- Creation validates required customer/destination/currency/lines, preserves
  exact decimal prices and nullable fields, translates all error shapes and
  avoids success/navigation on malformed/empty receipt IDs. Currency-context
  reads retain customer/org fallback and cancellation. No translated value
  enters requests, status/filter codes or money calculations.
- Attachments retain caller labels, scoped URLs, download arguments and
  optimistic rollback. HTTP failures retain prior list/download error behavior
  without showing server prose. Shared upload internals remain separately owned.
- 835 unit/static tests, 21 focused tests, two migrated REST/MCP/SQL groups,
  typecheck, zero-error lint, catalog/money/controller/ownership and diff gates
  passed. No schema, service, persisted-unit, FX or IRR flag change was made.

The initial placeholder assertion issue was confined to the test setup and is
resolved. Review is limited to this task: native terminology, mounted browser,
RTL, shared forms LOC-047, parent LOC-025/007/002 acceptance, complete document
MCP parity audit, provider/hosted CI/deployment and IRR qualification remain
independent. No full build or unrequested dev server was run.
