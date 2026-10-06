# MON-114 review 1 - technical self-review

2026-10-07, Asia/Tehran. Reviewer: coding-assistant; kind: self. The implementer
performed this review. This is not independent peer/human/accounting approval.

## Findings

- Reviewed all three routes, shared query/wire/service code, actual MCP registrations,
  fixtures, contract registry and split graph. The service requires view:data before
  DB reads, applies organization ownership to documents and labels, excludes deleted
  documents, and runs all source reads in one read-only repeatable-read transaction.
- Currency validation precedes totals, with explicit single-currency filters and no
  implicit conversion/rescaling. Source integers are text until checked bigint
  conversion; every exposed group/month/root/gross field is checked before the
  numeric alias. Exact cancellation and both signed safe edges pass actual fixtures.
- Money calculation uses bigint for sums, derived gross, averages and percentage
  products. Negative ties retain Math.round semantics. Distinct invoice sets avoid
  multi-line overcounting; item counts and physical quantities retain their units.
- Foreign/deleted labels are unavailable while original document reference IDs stay
  intact. Empty results select filter/default currency correctly. Invalid auth and
  custom permissions fail through actual handlers/tools without financial writes.
- Sales exporters consume the same checked snapshot and selected currency; XLSX
  precision guards reject lossy large values. PDF/XLSX and authenticated JSON parity
  pass. Existing status eligibility is documented honestly: statuses other than draft
  and void remain selected; no new accounting treatment is claimed.
- Added multi-line distinct-count, top-five ranking and unsafe stored-tax assertions
  during review; final focused tests/typecheck/changed-file lint pass. Fixed fixture
  cleanup between sales cases and restored unrelated Unicode text from committed
  source. Final source diff is confined to intended behavior/imports/registrations.
- The parent retains every original acceptance criterion and all five children,
  including inventory valuation integration; no missing report was marked complete.

## Decision and limitations

Approve MON-114 technical acceptance based on the documented checks. Full unit suite
322/322, focused/regression tests, typecheck, lint and money gates pass. Scope is the
three safe-range document analytics pairs and existing sales exports. In-memory row
grouping has not been high-volume qualified. Full-int64, historical remediation,
other reports, independent financial review and production IRR/release stay separate.
No schema or application database change; no deployment approval is recorded.
Structural controller validation passed. An optional broad controller test run was
stopped during its progressing full-backlog simulation; a full suite pass is not
claimed. The three task acceptance criteria do not require that optional simulation.
