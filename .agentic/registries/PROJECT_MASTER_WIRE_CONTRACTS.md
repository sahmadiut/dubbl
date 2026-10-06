# Project master, time and metadata contracts (MON-093)

2026-10-06, Asia/Tehran. Bounded child of MON-027; implementing-assistant
self-review, without independent financial/production approval. Direct scoped
Drizzle services: lib/api/project-master.ts. Strict schemas, exact aliases and
saved-row validation: project-master-wire.ts. The static operation catalog is
project-master-operations.ts; project-master-route.ts adapts existing REST paths,
and registerProjectMasterTools is registered in lib/mcp/tools/index.ts. Existing
project billing/profitability MCP names remain with MON-094.

## Operation map

Paths are relative to /api/v1/projects. REST [id] maps to MCP projectId. Other
bracket IDs are path parameters in REST and named fields in MCP. The Query ID
column identifies REST query-string identifiers (in MCP these remain ordinary
fields). All other create/update fields are JSON body fields, and list filters
are REST query fields. Unknown, duplicate query and body/path identifier fields
reject. POST returns 201, other successes 200. MCP uses wrapTool and the existing
server AuthContext. All 48 operations have distinct MCP tools. REST and MCP
share the same result envelopes; list pagination is data plus pagination with
page, limit, total, totalPages. Default page 1, limit 50, maximum limit 100.

| REST | MCP | Inputs (including IDs) | Result envelope | Query ID |
|---|---|---|---|---|
| GET / | list_projects | page, limit, status, priority | data, pagination | - |
| POST / | create_project | name, description, contactId, status, priority, billingType, color, budget, budgetMinor, hourlyRate, hourlyRateMinor, fixedPrice, fixedPriceMinor, estimatedHours, currency, startDate, endDate, category, tags, enableTimeline, enableTasks, enableTimeTracking, enableMilestones, enableNotes, enableBilling | project | - |
| GET /[id] | get_project | projectId | project | - |
| PATCH /[id] | update_project | name, description, contactId, status, priority, billingType, color, budget, budgetMinor, hourlyRate, hourlyRateMinor, fixedPrice, fixedPriceMinor, estimatedHours, currency, startDate, endDate, category, tags, enableTimeline, enableTasks, enableTimeTracking, enableMilestones, enableNotes, enableBilling, projectId | project | - |
| DELETE /[id] | delete_project | projectId | success | - |
| GET /[id]/members | list_project_members | projectId | members | - |
| POST /[id]/members | add_project_member | memberId, role, hourlyRate, hourlyRateMinor, costRate, costRateMinor, projectId | projectMember | - |
| PATCH /[id]/members | update_project_member | memberId, role, hourlyRate, hourlyRateMinor, costRate, costRateMinor, projectId | projectMember | - |
| DELETE /[id]/members | remove_project_member | projectId, memberId | success | memberId |
| GET /[id]/time-entries | list_project_time_entries | page, limit, projectId | data, pagination | - |
| POST /[id]/time-entries | create_project_time_entry | date, description, minutes, isBillable, hourlyRate, hourlyRateMinor, taskId, projectId | timeEntry | - |
| GET /[id]/time-entries/[entryId] | get_project_time_entry | projectId, entryId | timeEntry | - |
| PATCH /[id]/time-entries/[entryId] | update_project_time_entry | date, description, minutes, isBillable, hourlyRate, hourlyRateMinor, taskId, projectId, entryId | timeEntry | - |
| DELETE /[id]/time-entries/[entryId] | delete_project_time_entry | projectId, entryId | success | - |
| GET /[id]/timer | get_project_timer | projectId | timer | - |
| POST /[id]/timer | start_project_timer | description, taskId, isBillable, projectId | timer | - |
| PATCH /[id]/timer | update_project_timer | description, taskId, isBillable, pausedAt, accumulatedSeconds, projectId | timer | - |
| DELETE /[id]/timer | discard_project_timer | projectId | success | - |
| GET /[id]/milestones | list_project_milestones | projectId | milestones | - |
| POST /[id]/milestones | create_project_milestone | title, description, dueDate, amount, amountMinor, projectId | milestone | - |
| PATCH /[id]/milestones/[milestoneId] | update_project_milestone | title, description, dueDate, amount, amountMinor, status, progressPercent, sortOrder, projectId, milestoneId | milestone | - |
| DELETE /[id]/milestones/[milestoneId] | delete_project_milestone | projectId, milestoneId | success | - |
| GET /[id]/milestones/[milestoneId]/assignments | list_project_milestone_assignments | projectId, milestoneId | assignments | - |
| POST /[id]/milestones/[milestoneId]/assignments | create_project_milestone_assignment | amount, amountMinor, description, employeeId, memberId, projectId, milestoneId | assignment | - |
| PATCH /[id]/milestones/[milestoneId]/assignments | mark_project_milestone_assignment_paid | projectId, milestoneId, assignmentId | assignment | assignmentId |
| GET /[id]/tasks | list_project_tasks | projectId | tasks | - |
| POST /[id]/tasks | create_project_task | title, description, status, priority, assigneeId, teamId, startDate, dueDate, estimatedMinutes, labels, projectId | task | - |
| PATCH /[id]/tasks/[taskId] | update_project_task | title, description, status, priority, assigneeId, teamId, startDate, dueDate, estimatedMinutes, labels, sortOrder, projectId, taskId | task | - |
| DELETE /[id]/tasks/[taskId] | delete_project_task | projectId, taskId | success | - |
| GET /[id]/tasks/[taskId]/checklist | list_project_task_checklist | projectId, taskId | items | - |
| POST /[id]/tasks/[taskId]/checklist | create_project_task_checklist_item | title, projectId, taskId | item | - |
| PATCH /[id]/tasks/[taskId]/checklist | update_project_task_checklist | items, projectId, taskId | success | - |
| DELETE /[id]/tasks/[taskId]/checklist | delete_project_task_checklist_item | projectId, taskId, itemId | success | itemId |
| GET /[id]/tasks/[taskId]/comments | list_project_task_comments | projectId, taskId | comments | - |
| POST /[id]/tasks/[taskId]/comments | create_project_task_comment | content, projectId, taskId | comment | - |
| DELETE /[id]/tasks/[taskId]/comments | delete_project_task_comment | projectId, taskId, commentId | success | commentId |
| GET /[id]/labels | list_project_labels | projectId | labels | - |
| POST /[id]/labels | create_project_label | name, color, projectId | label | - |
| DELETE /[id]/labels | delete_project_label | projectId, labelId | success | labelId |
| GET /[id]/notes | list_project_notes | projectId | notes | - |
| POST /[id]/notes | create_project_note | content, isPinned, projectId | note | - |
| PATCH /[id]/notes | update_project_note | content, isPinned, projectId, noteId | note | noteId |
| DELETE /[id]/notes | delete_project_note | projectId, noteId | success | noteId |
| GET /[id]/teams | list_project_teams | projectId | teams | - |
| POST /[id]/teams | create_project_team | name, color, memberIds, projectId | team | - |
| GET /[id]/team-assignments | list_project_team_assignments | projectId | assignments | - |
| POST /[id]/team-assignments | assign_project_team | teamId, defaultRole, projectId | assignment | - |
| DELETE /[id]/team-assignments | unassign_project_team | projectId, teamId | success | teamId |

## Money and physical units

Existing numeric money remains nonnegative **fixed integer cents**. Currency
labels never rescale history or change the meaning of numeric fields. The
coexistence range is 0..9007199254740991. Canonical nonnegative signed-int64
strings above that range fail with LEGACY_NUMERIC_RANGE/422 before writes.
Malformed exact strings, alias conflict, unsafe/fractional/negative/negative-zero
numeric money, unknown fields and invalid dates are validation errors (REST 400;
MCP SDK/schema validation errors). Saved unsupported money/quantities/history
fails visibly with a classified 422; no rounded number/string fallback.

| Row type | Numeric fields and additive output aliases | Input behavior |
|---|---|---|
| Project | budget/budgetMinor, hourlyRate/hourlyRateMinor, fixedPrice/fixedPriceMinor, totalBilled/totalBilledMinor | First three writable; missing create values zero; totalBilled is read-only |
| Project member | hourlyRate/hourlyRateMinor, costRate/costRateMinor | Nullable overrides; missing create values null; hourlyRate null inherits project billing rate, costRate null means unknown/zero cost |
| Time entry | hourlyRate/hourlyRateMinor | Missing create rate inherits current user's unique project-member rate, then project rate; explicit zero overrides inheritance; patch omission preserves saved rate |
| Milestone | amount/amountMinor, invoicedAmountCents/invoicedAmountCentsMinor | amount defaults zero on create; invoiced cents read-only in this slice |
| Milestone assignment | amount/amountMinor | One alias required, nonnegative; linked to project's existing fixed-cents contract |
| Joined contact | creditLimit/creditLimitMinor | Existing nullable safe signed cents, output only |

Either numeric or exact input alias, or an exactly agreeing pair, is accepted.
Nulls must agree on nullable overrides. No alias is passed to an ORM writer.
Hourly/cost rates are cents **per hour**; all other fields above are cents totals.
This adoption does not establish currency minor-scale migration, saved FX or
full-int64 business support. Project currency stays the existing ISO label;
no money is converted for JPY/IRR or by magnitude.

Physical integer fields are not money: timeEntry.minutes is positive int32 on
writes; project.totalHours and estimatedHours are whole **minutes**, despite
their names; task.estimatedMinutes is nullable nonnegative int32; timer
accumulatedSeconds is nonnegative int32 **seconds**. Saved zero-minute entries
remain readable. Whole minutes/seconds have no Minor aliases. sortOrder is signed
int32. progressPercent is whole 0..100 percent. Dates are canonical Gregorian
YYYY-MM-DD; start must not follow end/due. Timer pausedAt is an ISO instant with
an explicit offset (or null), stored/returned as a UTC instant. Status/priority/
billing/member enums retain schema values. Text is text; project tags are up to
1000 strings, task labels are up to 1000 scoped label UUIDs, team member IDs are
up to 1000 distinct scoped UUIDs, checklist batches are 1..1000 distinct item IDs.
Task labels, members, contacts, teams, employees and invoices are never coerced
from arbitrary strings or borrowed from another tenant/project.

## Scope, authorization and transaction behavior

Every operation authenticates and resolves a live organization-scoped project,
including timer reads/update/discard and checklist/comment/assignment subresources.
Tasks and milestones must belong to the requested project; checklist/comment
rows must belong to that task; assignments must belong to that milestone.
New and saved references are scoped before use. Contact and payroll employee
writes require live referenced records; reads retain owned historical references.
Current member/user joins return public id/name/email/image rather than password
or authentication fields. Nested employee results expose id/name/email/
employeeNumber metadata rather than payroll financial/private fields. This is a
privacy correction to the former unrestricted relational expansions.

Writers require manage:projects, except the existing authenticated comment
create/own-delete and current-user timer update/discard policy. Custom-role
permissions remain authoritative. Comment deletion remains author-only. Timer
mutations cannot act as another user. Organization-first and project row locks
serialize adopted writers; all row changes, time totals, audits and returned-row
validation are in the same transaction. Read snapshots use repeatable-read.
There is no ledger posting in these metadata/master operations, so no accounting
period override is introduced. Period/currency/GL billing validation belongs to
MON-094 and parent financial qualification.

Time create/update/delete checks saved totalHours against exact bigint summed
entry minutes and applies the delta atomically, rejecting inconsistent history or
int32 aggregate overflow. Invoiced time cannot be edited/deleted. Project currency
cannot change after time/billing/member/milestone or financial source references
exist. Already invoiced milestone amounts cannot be reduced below invoiced cents;
invoiced or paid/payroll-linked milestones cannot be deleted. Referenced tasks
cannot delete while time/timer links exist; task labels must be removed from tasks
before deleting a label. Hard deletes validate the original and returned record;
project deletion remains soft. No posted history is rewritten or rescaled.

MON-027 integration additionally rejects fixedPrice edits below attributed fixed
invoice allocations (409), under the same organization/project locks. It reuses
billing history and excludes recharged registered expenses. See
[combined contracts](PROJECT_CRM_PRICING_INTEGRATION.md) for the qualified
cross-writer behavior; original child evidence remains unchanged.

## Retry, compatibility corrections and clients

Creates/time/comment appends have no invented idempotency token; callers must
avoid blind retries. Duplicate member/team assignments reject under the org lock.
Timer start deliberately replaces this user's current project timer and discards
its elapsed time; it is not a stop-and-save operation. Timer discard is repeatable
and saves no time. Resume retains client-supplied accumulatedSeconds and resets
startedAt to now, preserving the existing explicit pause/resume contract.
Mark-assignment-paid changes **isPaid metadata only**, with no transfer, payroll
or GL posting; repeating it returns the existing row without writes or new audit.
Task/milestone same-terminal-state updates retain completedAt; reopening clears it.
Ordinary updates can append an audit; empty child patches are read-only no-ops.
Checklist batches preflight every ID before any update and roll back together.

Strict input/date/physical bounds, public-user joins, missing/foreign-root errors,
int32 total guards and rejection of billed/paid/dangling references are deliberate
corrections to unsafe permissive/unscoped legacy behavior. Removed-member, dangling
label or inconsistent total histories need explicit remediation. Numeric fields,
units, root/list/create/update envelopes and status codes remain compatible for
supported data. Organization team assignment stores the existing assignment
metadata; it does not silently materialize members or reinterpret a local project
team as an organization team.

Master/settings/member/milestone editors submit exact cents; hour inputs use
bigint decimal conversion and settings preserve existing whole minutes on reopen.
Loaded time valuations use exact half-up minute-by-rate products and bigint sums.
Project/milestone totals display exact fixed cents. The project list refuses a
single monetary summary across unlike currencies. Billing/progress-invoice
preview generation remains MON-094. The tracking picker now requests the supported
100-row cap (previously its 200 request was silently capped); marking an assignment
paid now uses the actual query-ID route and reports failures before success. The existing client stop/save action remains
separate time-create and timer-discard requests; it has no combined atomic retry
contract in this slice. Locale/RTL/calendar, general scale and high-volume paging
qualification remain separate; current reads load scoped rows before pagination.

## Verification and remaining gates

Four pure groups plus tests/integration/project-master.test.ts exercise actual
API-key REST handlers and full MCP SDK registration/transport on randomly named,
migrated disposable PostgreSQL databases. Fixtures cover all 48 operation pairs,
legacy/exact/agreed/null/maximal money, physical/time/rate inheritance, public
joins, custom roles/expired keys, foreign roots/references, checklist/task isolation,
all writer audit rollback, financial returned-money faults, int32 time totals,
unsupported saved values, paid retry and concurrent time/timer/member operations.
No dev server, build, browser screenshots, Docker, schema change or migration
creation is needed. No production data/provider/deployment is touched. Parent
MON-027, MON-094 and other financial gates retain billing/profitability,
full-range, independent accounting/performance and production IRR qualification.
