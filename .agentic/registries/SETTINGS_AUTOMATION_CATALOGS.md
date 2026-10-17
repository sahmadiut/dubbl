# Settings automation catalogs

LOC-015 is the settings automation child of LOC-012. It adds 360 matching
English/Persian keys, including five additions to SettingsErrors, for 1,398 keys
per production locale. Persian wording is **provisional** pending native
linguistic/financial review. LOC-012, LOC-006 and LOC-002 retain independent
combined acceptance; RTL and browser workflow qualification remain separate.

## Extracted inventory

| Source | Catalog and behavior |
|---|---|
| `app/(dashboard)/settings/bank-rules/page.tsx`, `i18n/bank-rule-presentation.ts` | SettingsBankRules: headings, emptiness, form labels/placeholders/tooltips, options/operators, success/error toasts, match summaries, AND/OR joins, ranges, counts, split descriptions and clear-without-moving-money guidance. Signed canonical bank minor-unit parsing, safe-range checks, legacy mirrors, splitting and reference IDs remain unchanged. |
| `app/(dashboard)/settings/approval-workflows/page.tsx`, `components/settings/approval-condition-help.tsx` | SettingsApprovals: heading, form/actions/status/errors, entity/operator labels, condition and step counts, complete entity-specific no-condition sentences and canonical minor-unit help. Existing org-key remount, save guard, condition validation, member IDs, approver order and required flags remain intact. |
| `app/(dashboard)/settings/pipelines/page.tsx`, `i18n/pipeline-stages.ts` | SettingsPipelines: page/editor/title, confirmations with escaped names, seeded new-stage names, actions, stage counts, dirty confirmation, accessible controls and complete drag instructions/announcements. IDs/colors, stage ordering, keyboard sensors, saved stage names and default behavior remain unchanged. Only newly created stage names use the selected language. |
| `app/(dashboard)/settings/webhooks/page.tsx`, `i18n/webhook-status.ts` | SettingsWebhooks: list/form/empty text, event-group headings, actions/errors, counts, URL validation and all four persisted delivery statuses (pending/success/failed/retrying). Unknown statuses get a generic label. Event codes, request URLs/methods, selected subscriptions, endpoint validation and HTTP status codes remain machine values. |
| `app/(dashboard)/settings/reminders/page.tsx`, `components/settings/reminder-template-fields.tsx` | SettingsReminders: titles, trigger/recipient/document/status labels, forms/actions/errors/confirmations, logs, full pagination/day messages and variable insertion labels. Literal double-brace placeholder examples render without being interpreted as ICU arguments. Existing subject/body data, trigger values, days, recipients and insertion tokens remain unchanged. |
| `app/(dashboard)/settings/notifications/page.tsx`, `components/settings/notification-preferences-form.tsx` | SettingsNotifications: headings, seven notification type descriptions, both channel labels, accessible switch names, save/error states and conditional email-digest help. Original defaults (in-app on, email off), type IDs, in_app/email channels and email digest interval of 120 minutes remain intact. |
| `i18n/settings-errors.ts` | SettingsErrors: exact known bank-rule/workflow/webhook/pipeline/reminder not-found mappings alongside existing auth/permission/input fallbacks. Only mapped SettingsRequestError instances may carry translated error text through catch handlers; unexpected network/JSON/wire errors use the operation fallback. No server/domain/MCP output is translated. |

## Explicit exceptions

| Literal or data | Boundary |
|---|---|
| Event codes such as `invoice.created`, `journal.posted`, `approval.completed` | Webhook subscription identities are intentionally shown verbatim for integration configuration. Group headings and surrounding product text are translated. |
| `HTTP`, response status numbers, `http://`, `https://`, sample endpoint/email addresses, Stripe, USD | Protocol/provider/currency identities and technical samples preserve their spelling. Surrounding sample/help wording has catalog keys. |
| `total`, `totalAmount`, `status`, condition operators, entity/status/trigger/channel codes | API/schema identities remain ASCII in requests and editable technical condition fields; their product labels are translated. |
| `{{contactName}}`, `{{documentNumber}}`, `{{amountDue}}`, `{{dueDate}}`, `{{organizationName}}`, `{{daysOverdue}}` | Literal reminder-engine insertion tokens, never localized or converted into ICU variable names. ICU quoting preserves them in sample placeholders. |
| Saved rule/workflow/pipeline/stage names; accounts, contacts, tax rates and member names/emails; webhook URL/description; reminder subjects/templates and recipient emails | User/organization data stays verbatim and React-escaped. Saved names are never retrospectively translated. Newly created pipeline seed names are localized editable user data. |
| Canonical money inputs, amounts in range summaries, priority, step ordinals, counts, days, percentages and hex colors | No currency scaling or financial-number localization is introduced. ICU formats message counts; existing numeric and canonical money inputs retain their validation. Numeric-only priority placeholder `0`, separators, dashes and arrows remain symbols/data. |
| Reminder log timestamp formatting | Existing `new Date(...).toLocaleDateString()` is unchanged; centralized date/calendar adoption belongs to the later presentation tasks. No locale/date correctness claim here. |
| Browser-owned constraint messages, native confirm chrome, keyboard key names | Required/type/min behavior and native controls are retained; all application-supplied confirmation content is translated. Pipeline drag instructions and announcements are now explicitly catalog-backed. |
| Unknown API/network/wire messages | Operation/input/auth fallback is shown instead of arbitrary server prose. Machine error responses remain untouched. |

No REST handler, shared domain service, database schema, migration or MCP tool
changed. Existing bank-rules, approvals, CRM, webhooks, reminders and notifications
MCP modules continue to expose the same operations. Extraction adds no user
operation or transport contract.

## Verification and remaining acceptance

`tests/settings-automation-catalogs.test.ts` renders real React/next-intl pages,
loaded notification controls, reminder template fields and condition guidance.
It checks stable identifiers, channel defaults/payloads, digest/saving branches,
literal insertion tokens, escaping, legacy and multi-condition bank summaries,
exact minor-unit text, pipeline seed IDs/colors, drag announcements, every webhook
delivery status, error fallbacks, complete plurals/pagination and bounded JSX and
machine-identity extraction. Other catalog/locale suites validate ICU contracts
and provider resolution. These checks do not constitute browser clicks, drag
interaction, persisted workflow, native-language or RTL approval.

Pre-existing pipeline deletion copy says live deals lose their reference, while
the current CRM service rejects deletion with live deals. The text is retained
for English compatibility in this extraction; LOC-012 combined acceptance must
resolve it. Existing reminder/pipeline delete handlers do not inspect every HTTP
failure, and several initial data loads lack error reporting; no persistence or
error-handling correctness beyond the mapped presentation is claimed here.

See [attempt 1](../evidence/LOC-015-attempt-1.md) and
[self-review](../evidence/LOC-015-review-1.md) for actual commands and limitations.
