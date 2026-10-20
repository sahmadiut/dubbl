# LOC-088 review 1

Reviewer: Codex. Kind: self. Date: 2026-10-21 (Asia/Tehran).
Scope: LOC-088 only; not independent peer/human/native linguistic review.

Reviewed the self-service page, presentation reader, paired catalogs, production
rendering/callback tests, migrated output/time workers, source guard, generated
money inventory, task handoff and
[scope/exception registry](../registries/PAYROLL_SELF_SERVICE_CATALOGS.md).

All authored page copy is extracted into 42 paired keys. Every added Persian
leaf contains Persian script. The production JSX renders through real
next-intl/PresentationProvider in both locales; saved data remains escaped.
Four timesheet status and seven leave-type labels are finite translated keys.
Remaining saved names/IDs/numbers, punctuation, counts and date/hour/money
formatting exceptions are explicit. No untracked authored JSX prose or raw
visible attributes remain in the focused AST audit.

The reader rejects failed HTTP, invalid JSON/envelopes, malformed displayed
fields, conflicting/missing money aliases, unsupported currencies, invalid or
reversed Gregorian periods, malformed generated timestamps, nonphysical hours,
unknown finite labels and duplicate IDs. Histories and PATCH responses must
match the authenticated employee. Actual REST/linked MCP responses pass this
reader under migrated PostgreSQL fixtures with independent SQL, identity,
permissions, organization isolation, rollback and audit assertions retained.

Missing organization/storage releases loading. Profile 404 retains the
missing-profile state and clears previous read errors. All other failures use
finite translated feedback with no diagnostic prose. Obsolete read success and
failure are ignored, including late history. Failed reads adopt no partial
profile/history/form data. Failed saves retain edits and release busy; success
requires a checked response. PATCH email/bank fields and existing empty-value
omission remain unchanged. The ten/five history limits and payslip count remain.

Existing employee authorization, request methods/routes/headers, machine values,
physical hours, canonical dates, exact fixed-two payroll cents and stored values
are preserved. No backend/schema/migration, financial calculation, statutory
identifier, provider, IRR flag or Stripe change. Existing MCP tools already cover
the owned operations. Generated inventory changes are consumer evidence plus
three existing schema-comment encoding refreshes; actual stored column
definitions, classifications and units remain unchanged.

During self-review the profile-404 branch was corrected to clear an old error;
its final focused regression passes. The nullable valid-reader assertion now
awaits its promise. No unresolved finding within this extraction scope.

Approve: 1,218 full tests, 10 focused tests, two migrated REST/MCP/SQL fixtures,
final typecheck, zero-warning owned lint, zero-error full lint (41 warnings
elsewhere), catalog validation, money/source/legacy guards, controller validation
and diff check passed. Actual commands/results are in
[attempt evidence](LOC-088-attempt-1.md).

Persian wording remains provisional. LOC-067/008/002 independent acceptance,
native terminology, full RTL/calendar/numerals, mounted browser/keyboard,
hosted CI, deployment and production release remain unclaimed. No full build,
unrequested dev server or Stripe work. Controller approval is structural
workflow evidence, not proof of independent review authenticity.
