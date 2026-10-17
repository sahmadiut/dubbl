# LOC-005 self-review 1

2026-10-17, coding-assistant, self-review. This is not independent peer or human
approval. Reviewed the implementation, actual command results, catalog typing,
English/Persian label diff, generated inventory and controller split against
[attempt 1](LOC-005-attempt-1.md).

The split retains LOC-002's original criteria and independent final acceptance;
no broad extraction or native terminology completion is claimed. The new gate
checks both catalog directions and nested ICU nodes. It preserves locale-specific
ordinal differences, while exact cases, offsets, argument kinds and styles stay
compatible. Tests include real parser/runtime behavior, negative missing/unsafe
cases, React escaping, stable preference values, and compile-time key rejection.

Review improvements included a valid nested/escaped/reordered-message case,
missing-argument runtime rejection, and lint coverage for direct JSON catalog
imports. The root provider has only a catalog-transport exception, not an HTML
exception. The parser remains dev-only; existing request loading is unchanged.

The UI diff changes only label expressions; original en-US strings and persisted
values are preserved. No DB, money math, authorization, REST/MCP operation or
schema is changed. New Persian calendar labels are explicitly provisional.
Inventory updates contain current source hashes/occurrences, not money policy
changes. Final full suite is 575/575; focused tests 17/17; typecheck, catalog gate,
lint and money guards pass. Existing lint warnings remain unrelated.

Approve LOC-005 within its bounded scope. Browser/native-language review and
hosted CI were not performed by this review and are not represented as passed.
Proceed with controller completion and the authorized scoped commit/push only.
