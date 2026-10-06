# MON-085 review 1

2026-10-06, Asia/Tehran; reviewer coding-assistant, the implementing assistant.
Actual self-review, not independent peer/human financial or security approval.
Reviewed current source/diff, wire registry and MON-085-attempt-1 actual results.

All 16 paired boundaries share scoped direct-DB services, strict described input
schemas and explicit safe numeric/Minor output contracts. Existing tool names and
REST envelopes remain; per-run payslip REST parity is additive. Ownership is
checked before sensitive detail reads, status changes and tax output. Nested
run/item/employee/project/time/deduction/member/form/recipient links fail closed.
Self-service rejects ambiguous member profiles and cannot patch salary/currency
or another user. Tax operations consistently require payroll management access;
view:payslips retains its explicit organization-level grant.

Reviewed bigint aggregates, half-away average rounding, saved run/item currencies,
mixed single-total rejection, exact fixed-cents formatting, opaque known money
fields/aliases and unsafe JSONB/ORM outputs. Same-year YTD excludes deleted/prior
runs; existing snapshots are preserved; organization locks make missing-snapshot
retries atomic across transports. Current currency changes do not alter saved
slip/form amounts. W-2 consumes actual withholding and complete deductions, not
estimated current rates; NEC uses saved payment dates with UTC legacy timestamp
fallback and the retained USD threshold. Unsupported 1099-MISC, currencies and
incomplete legacy detail reject before a batch. No new statutory policy/filing
accuracy or payroll unit/FX migration is inferred.

Every changed writer awaits audit in the same transaction and preflights supported
output before commit; injected PostgreSQL faults prove slip/batch/view/profile
rollback. Self-profile audit avoids bank values. CSV text escaping/formula guards,
safe-max/signed cents and authenticated downloads are coherent with the recorded
contracts. Run UI matches snapshots by actual item ID; error paths do not report
viewed status on failed requests. The existing /pdf route remains JSON and the
UI calls the download form data; no fake PDF file or renderer claim.

Development nullable typing, aggregate/month and UUID-order fixture expectations
were corrected and rerun. Diff review repaired Windows text encoding, membership
preflight received a negative fixture and obsolete lint suppression was removed.
Final broad regression passes 341/341 (264 pure, 77 migrated PostgreSQL), no skips,
including all 16 new REST/MCP pairs and historical migration/backup preservation.
Final focused fixtures pass 7/7; typecheck, lint (0 errors, 129 existing warnings),
changed implementation lint, source inventory, legacy import guard and diff checks
pass. No slice finding remains that blocks its three acceptance criteria.

Approve this bounded self-review. Parent MON-025 retains integrated acceptance;
MON-034/locale and financial/release tasks retain true PDFs, general currency/
regime/locale scale, legacy remediation, large-history performance, full-int64,
browser/session/OAuth and independent financial/security/production qualification.
No schema/history rewrite, dev server/full build, deployment/provider/production
migration or IRR rollout occurred. Close controller, perform authorized commit/
push, verify synchronized master and stop; next ready task is MON-026.
