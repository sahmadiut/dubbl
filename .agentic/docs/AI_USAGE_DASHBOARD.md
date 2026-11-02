# Scoped bilingual usage and operations views

AI-059 adds `/settings/ai/usage` to existing settings navigation, with distinct
My usage and organization views. `/admin/ai` embeds a separate site-session
aggregate dashboard. Site requests need no organization and never load
organization run controls. AI-011 retains independent assembled acceptance.

The browser uses AI-055/056 reporting/export endpoints and AI-058 operations,
with their existing matching MCP tools. No provider calls, rollout changes,
schema/migration, ledger calculation or Stripe work is introduced.

## Reports and precision

Apply uses an editable filter draft; pagination and export use the last applied
filters. Reload and page changes preserve edits; scope/organization changes
clear them. Reset restores the current UTC month and clears optional filters.
Dates are canonical Gregorian, inclusive From and exclusive To (maximum 93
days). Exact member/provider/price UUID, model, billing currency and attempt
state filters are supported; site additionally permits organization UUID.
Run filters use dates/member/run state only. Quota independently explains the
current UTC month for an explicit billing currency.

Full filtered totals are supplied by the service, never summed from a page.
Each currency stays separate. Token/count strings and twelve-decimal major
billing-currency cost strings never pass through Number. Each group identifies
its immutable price version. Observed partial sums, unknown counts, reserved,
unresolved and settled estimates stay distinct. Missing prices do not imply
free use; missing/zero/exhausted budgets block or restrict use. Quota is an
observation, not a request admission or provider readiness guarantee.

The JSON download includes all matching groups and full totals, exact units,
partial-observation metadata and completeness marker. It omits pagination
inputs. More than 10,000 groups fails explicitly without a partial download.
Independent pages and exports observe fresh snapshots, not a frozen session.

## Authorization and interventions

Own reads require view:ai-history; organization reads require view:ai-usage.
Denied scopes show an explanation without data. Configuration controls load
independently under manage:ai-providers; an ordinary user/auditor's denied
configuration request does not suppress their authorized reports.

The content-free run detail adds advisory `canStop`, calculated from the final
live permission check and persisted state, identically on REST/MCP. Actual Stop
still checks current permission and reviewed version transactionally. No
transcripts, business record links or private diagnostics are introduced.

Stop/Disable confirmations identify the exact run/configuration UUID and version
and initially focus Keep unchanged. Opening a dialog performs no mutation.
Completed effects and credentials remain; in-flight outcomes can be uncertain.
Conflicts/errors remove the reviewed target and require an explicit fresh
inspection/reload before another confirmation. Writes never auto-retry; rapid
duplicate submissions are fenced. A denied intervention/export clears loaded
scope data and invalidates overlapping reads, while filter drafts remain.

All requests/results/downloads bind to organization, scope generation and read
sequence. Late responses across A/B/A organization switches or disposal cannot
populate a new scope or trigger a download. Data is not stored in browser
storage. Focus/storage changes synchronize the active organization.

## Presentation and qualification

English/Persian catalogs, production PresentationProvider and shared instant
formatting preserve language, RTL, independent calendar/numerals and timezone.
UTC reset is also shown canonically. IDs/decimals use bidi isolation. Responsive
grids, wrapped actions, minimum 44px controls and a labeled keyboard-focusable
table scroll region bound wide content.

Behavioral component tests invoke production JSX handlers with controlled hook
state, and a disposable PostgreSQL integration drives the browser controller
through actual REST handlers. These qualify the tested interactions, not actual
browser viewport/zoom, screen-reader behavior or native Persian approval.
Those and production session/provider/deployment/activation gates remain open.
