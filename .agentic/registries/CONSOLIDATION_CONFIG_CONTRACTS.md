# Consolidation configuration contracts (MON-095)

2026-10-06, Asia/Tehran. Shared direct-DB services: lib/api/consolidation-config.ts
and consolidation-config-wire.ts. Existing registerConsolidationTools /
registerAllTools registration and wrapTool are retained.

## Complete boundary map

REST paths are relative to /api/v1/consolidation/groups. All readers require
authenticated AuthContext; all seven writers require manage:reports, including
custom-role permissions. Ownership is parentOrgId == ctx.organizationId.

| REST method/path | MCP operation | Input | Result envelope |
|---|---|---|---|
| GET / | list_consolidation_groups | None | REST groups with public members; MCP existing id/name/presentationCurrency/memberCount/member projections |
| POST / | create_consolidation_group | name, optional presentationCurrency | group with empty members; REST 201 |
| GET /{id} | get_consolidation_group | Group UUID | group with public members |
| PATCH /{id} | update_consolidation_group | At least one of name/presentationCurrency | group with public members |
| DELETE /{id} | delete_consolidation_group | Group UUID | success; soft deletion retains children/history |
| GET /{id}/members | list_consolidation_members | Group UUID | groupId, presentationCurrency, members: id/orgId/label/orgName/functionalCurrency |
| POST /{id}/members | add_consolidation_member | orgId, optional nullable label/functionalCurrency | member link; REST 201 |
| DELETE /{id}/members | remove_consolidation_member | orgId | success, additive REST removedMemberId / existing MCP removedMemberId |
| GET /{id}/rules | list_consolidation_elimination_rules | Group UUID | groupId, rules with existing id/name/kind/prefix/description projections |
| POST /{id}/rules | create_consolidation_elimination_rule | name, kind, optional nullable debitAccountMatch/creditAccountMatch/description | rule; REST 201 |
| DELETE /{id}/rules/{ruleId} | delete_consolidation_elimination_rule | Group and rule UUIDs | success, deletedRuleId; soft deletion retains historical entries |

Four group CRUD MCP tools, REST member GET and REST rule operations close parity
gaps. Tool schemas are strict and described. Dashboard group.members[].organization
id/name and existing create/list/member/remove envelopes remain supported.

## Units, aliases and ranges

These eleven configuration operations have no money, price, FX rate, date-only
or physical quantity inputs. Minor/rateExact aliases are not applicable. Counts
remain numeric array lengths; UUIDs remain identifiers. ISO currency labels
normalize on input and must be canonical on saved output. Labels do not change
member ledgers or convert/rescale amounts. Legacy name-only creation defaults
USD; nullable functionalCurrency remains report configuration, falling back to
organization.defaultCurrency. Explicit USD/JPY/KWD/IRR labels are configuration,
not production currency enablement.

Names are trimmed nonempty strings up to 1000 characters; nullable labels up to
1000, nullable account prefixes up to 100, nullable descriptions up to 10000.
Empty labels/prefixes normalize to null on creation. Kinds retain ar_ap,
sales_cogs, investment_equity and custom; investment_equity remains a report
stub. Unknown fields, amount aliases, bad UUIDs/currencies/types, malformed JSON
and empty group patches fail before mutation: REST 400 / MCP validation error.
Unsupported/noncanonical saved currencies/rules or duplicate saved members fail
classified LEGACY_NUMERIC_RANGE 422; no inferred historical repairs.

Cross-organization projections contain only id/name/slug/defaultCurrency.
Financial, provider and contact settings are no longer returned through group
list/detail. Unrelated unsafe historical organization money cannot trigger a
decode failure or leak through this boundary. Organization settings money and
its aliases remain MON-070 ownership.

## Scope, concurrency and atomicity

Owned live groups and rule-within-group IDs are required. Organization joins
require live children and caller current membership. Revoked/deleted members
fail closed on reads, adds, group updates/deletes and rule operations. Parent
managers can unlink revoked members without reading their organization.
Duplicate saved members fail closed until explicit remediation.

Writers lock the parent organization before reading/mutating, serializing
duplicate checks and group deletion with other adopted configuration writers.
Rows, awaited audit and response preflight commit in one transaction. Reads use
repeatable-read snapshots. Presentation currency changes reject 409 if saved
rates/elimination entries exist; name-only edits preserve currency. Duplicate
adds return 409, missing roots/nested IDs 404, inaccessible organizations 403.
Creates are new events without invented replay keys. Soft-delete/remove retries
return 404. Configuration operations never edit a member ledger.

## Qualification and remaining ownership

tests/integration/consolidation-config.test.ts uses random migrated fixture DBs
and actual REST API-key handlers/full registered MCP SDK tools. Assertions cover
all operations, strict described fields, custom roles, expired/bad keys, spoofed
headers, foreign roots/rules, inaccessible/revoked/deleted members, legacy and
explicit currency clients, invalid saved currencies/rules/duplicate history,
unsafe hidden organization money, saved rate/elimination guards, all-writer
audit faults, group/member/rule output faults and concurrent add/delete.

MON-096 owns report/rate/translation, persisted elimination arithmetic, money/FX
aliases, report persistence MCP parity, historical currency interpretation and
concurrency with the old report writer. That writer does not yet take the
configuration organization lock; this child does not qualify report persistence
races. MCP reporting now loads public scoped groups; arithmetic is unchanged.
MON-097/098 own accrual/revenue posting, MON-099 recurring payables. MON-028
retains combined acceptance with all parent criteria unchanged. No schema,
migration, history rewrite, full-int64 adoption, production IRR flag change,
independent accounting approval or deployment is implied.
