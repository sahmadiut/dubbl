# AI-004 self-review

2026-10-27, Codex task_004_recovery, kind **self**. Recovered another Codex agent's
unfinished implementation and performed final repairs/tests. This is honestly
self-review of the final changes; no peer/human approval or live-provider
qualification is claimed.

Resolved findings:

- HTTPS typing failed with an unsupported RequestOptions property/test callback.
  Removed redundant family-auto-selection flag; explicit validated lookup/family
  remains pinned and exercised by transport fixture assertions.
- Platform read parity was missing: added dedicated site-admin-session REST/MCP
  listing; owner and site-admin API-key requests are denied. Delegated listing
  excludes other organization IDs.
- Equivalent expanded IPv6 documentation ranges could evade textual range tests:
  canonicalize IPv6 spellings and add negative fixtures.
- Provider could return a different model: fail closed rather than imply success
  for the configured model. Fixture confirms rejection.
- Credential revocation must remain possible after delegation withdrawal: allow
  removal of an organization's own secret while retaining delegation for rotation.
- Raw JSON parser diagnostics can include submitted secrets: credential route
  converts malformed-body failures into a static error before generic logging.
- Bound DNS configuration checks as well as total connection-test request time.
  Never follow redirects or trust mixed public/private DNS results.
- Preserve default-off provider behavior; tests use mocked transport and ephemeral
  fixture secrets only. Full provider eligibility/run/UI work remains later scope.

Acceptance: approve provider administration/configuration boundary, supported by
the attempt evidence and final passing checks. Financial/authorization/provider
qualification, production rollout and independent human security gates remain
unchanged.
