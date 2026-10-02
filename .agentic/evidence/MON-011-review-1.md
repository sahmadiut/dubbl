# MON-011 self-review 1

2026-10-02, Asia/Tehran. Reviewer: codex, the implementing assistant. Self-review,
not independent peer/human/accounting review or production approval.

Approved within the foundation scope. Reviewed the exact DTO/Zod schemas,
signed ranges, explicit safe bridge, serializer/REST/MCP changes, ORM error
classification, synthetic fixtures and task/documentation/inventory changes.
Parent MON-006 acceptance was retained; exact public endpoint adoption is not
claimed. Neither units, posted balances, schema nor rollout flags change.

Review identified malformed/conflicting-alias refinements that could attempt a
BigInt/rate conversion after child validation failed. Comparisons now require
valid operands; fixtures verify ordinary Zod errors for invalid dual fields.
Bounded parsing before BigInt also rejects oversized integer strings. Typecheck
identified mixed generic negative-fixture results; explicit unknown fixes fixture
typing without weakening runtime schemas. Final full suite has 83/83 passes;
typecheck passes, full lint has 0 errors/167 preexisting warnings, final changed-file
lint is clean, and inventory/Drizzle/hash/diff checks pass.

Safe numeric legacy values and JSON status/header behavior remain compatible.
Unsafe/nonfinite values fail visibly instead of rounded numbers/null; exact mode
requires an explicit server contract and cannot recover upstream Number rounding.
All aliases preserve minor units and rate direction; tiny/high rates require
exact DTOs instead of silent legacy rounding. BigInt.prototype is untouched.
MCP context propagation and synchronous auth/error behavior are tested; no new
queries, permissions or public operations are introduced. These tests do not
assert DB organization isolation or public endpoint/client qualification.

Limitations are explicit in ADR-006 and handoff: serializers cannot roll back
earlier writes, direct responses/domain input schemas remain MON-012, full-range
ORM/business consumers remain MON-007/008, raw aggregates/opaque envelopes need
their own adoption, and a real deprecation window awaits owner agreement at
client migration/contraction. No integration DB run, live provider, build/dev,
IRR enablement, production rollout or independent approval is asserted.
