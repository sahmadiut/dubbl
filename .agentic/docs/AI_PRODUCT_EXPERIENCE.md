# AI product experience and acceptance contract

Planning revision, 2026-10-28, requested by the owner: review and improve all AI tasks for professional UI/UX and ease of use. This defines future acceptance, not implemented behavior. Read alongside [execution contracts](AI_EXECUTION_CONTRACT.md), [current lifecycle](AI_RUN_LIFECYCLE.md), [provider configuration](AI_PROVIDER_CONFIGURATION.md) and [usage contracts](AI_USAGE_BUDGETS.md). Existing owner scope and release gates prevail. Completed task records and evidence remain unchanged.

## Product structure and responsibility

Use the existing dashboard shell, navigation, typography, spacing, theme tokens, form controls and presentation adapters. Provide a discoverable Assistant destination for permitted users, with New conversation, own history and own usage. Keep provider secrets, technical model capabilities and policy editing in administration. Do not require ordinary users to understand tool names, tokens, agent IDs or provider endpoints to complete business work.

| Surface | Responsible task | Outcome |
|---|---|---|
| Runtime data for progress, clarification and safe recovery | AI-023, independently integrated by AI-007 | Durable server state that UI and MCP can actually consume |
| Concrete preview and approval services | AI-008 | Exact, understandable, versioned decisions |
| Conversation workspace, composer and history | AI-026, integrated by AI-009 | Start, find and continue work comfortably |
| Action cards, clarification, approval and recovery UI | AI-027, integrated by AI-009 | Understand what happened and what needs attention |
| Guided provider setup and readiness | AI-024 | Administrator can identify and resolve setup blockers |
| Understandable tool policies and safe settings edits | AI-025 | Administrator can see effective access and consequences |
| Usage, price/budget management and operations | AI-011 | Costs, limits and interventions are understandable |
| Domain result contracts and realistic scenarios | AI-014..021 | UI suggestions and outcomes match actual supported operations |
| Integrated usability and accessibility qualification | AI-028 | Measured journeys, recovery and bilingual layout evidence |
| Security/reliability and final acceptance | AI-012, AI-013 | Coverage and UX work cannot be bypassed by the dependency graph |

## Core journeys

1. **First use:** open Assistant, see current organization and a short description of supported work, choose an authorized example or type a request. Examples populate an editable composer; they do not execute immediately. No-provider, disabled, permission-denied, empty-history and temporary-outage states have different explanations and useful next actions. Setup links appear only for users authorized to configure it.
2. **Find and prepare:** ask to find a supplier/customer and prepare a supported draft. If names collide, show only permitted candidate records with distinguishing business details and a selectable stable reference; ask only for unresolved required information. Reuse explicit conversation context without guessing currency, calendar, recipient or amount units. Show the draft's real record link and status after creation. Never describe a draft as posted, paid or sent.
3. **Review sensitive work:** show the action, target, before/after fields where applicable, exact amount and currency, recipients, irreversible effects and existing business approval requirements. Use action-specific labels, such as Approve sending, with equally reachable reject/cancel. A selected batch displays every effect and totals separately per currency. No hidden actions or preselected sensitive effects. Edits, expired authorization or changed records require a new preview.
4. **Stop and recover:** stop from the visible run controls, see stopping until acknowledged, and retain completed effects and uncertain outcomes. Reload or reconnect resumes observation; it never resubmits the request. Provide a safe continuation or record-inspection action appropriate to the server state. A new request explicitly describes what remains; it does not replay the entire previous workflow.
5. **Understand a report:** show actual source record/report links, filters, date range, calendar/timezone where relevant, currency and data-as-of time. Distinguish service-calculated facts from AI explanation. Paginated/truncated output says what is omitted and offers the authorized source view. Never invent totals from a partial page or combine currencies.
6. **Configure and operate:** a delegated admin progresses through provider/model, credential, price, organization/member budgets and tool policies, then an explicit connection test and readiness review. Identify site-operator-only blockers without exposing deployment secrets. A successful test is not production qualification or activation. An authorized operator can inspect failures and usage without receiving private transcripts.

## Conversation and interaction rules

- Layout: desktop history rail and main conversation; narrow-screen history drawer with focus return; visible organization/title and run status; composer and Stop reachable without covering messages or approval controls. Readable prose width, consistent card hierarchy, restrained status color, no decorative telemetry or fabricated progress percentage.
- Composer: visible Send, Enter to send and Shift+Enter for newline; IME composition never sends. Preserve input on validation/network failure; disable duplicate submission while retaining copy/edit access. Explain input limits before rejecting. Pasted text remains untrusted. Do not add attachment, voice, web browsing or file-ingestion affordances without their own supported scope.
- When a run is active, typed follow-up remains a local draft until a permitted submission or clarification transition is available. There is no implicit second concurrent run. Clarification responses bind to the pending server request/version and cannot approve sensitive actions.
- Streaming: distinguish provisional assistant text from confirmed tool outcomes. Maintain reading position when the user scrolls up, offer Jump to latest, avoid focus stealing and announce milestones rather than every token. Interrupted streams show reconnecting and retain already persisted content. Transport reconnect is distinct from retrying business actions.
- History: cursor/page navigation, title search with explicit scope, rename, delete confirmation and restore of the selected conversation after navigation. Implement missing shared REST/MCP operations rather than client-only simulations. Deleted/expired content has an honest state; deletion does not delete business records or promise immediate erasure of billing metadata/backups. Edit/resend must never rewrite a completed action or approval; use a new versioned request.
- Privacy: make a short, accurate explanation of provider processing, configured retention and authorized transcript audit available near first use/history controls. Show only verified provider policies; do not promise secrecy from authorized auditors or zero retention. Clear tenant-specific drafts, caches, streams and results on organization switch, logout or lost access. A late response from the previous organization is discarded.

## State and action contract

Use stable machine states and localized labels; UI does not invent transitions. AI-023/008 own any missing shared REST/MCP state or operation. Cursor events are content-free notifications; fetch authorized bounded display data separately. Do not place prompts, customer data or secrets into public progress events.

| State / condition | User presentation | Permitted next action |
|---|---|---|
| Queued | Waiting to start, truthful queue/limit explanation | Stop; no invented queue position or ETA |
| Running | Current business action and completed steps | Stop, inspect completed records |
| Awaiting input | Specific question and scoped candidate choices | Answer or cancel; no unrelated actions advance |
| Awaiting approval | Exact versioned preview and expiry | Explicit approval, reject or revise preview |
| Stop requested | Stopping; in-flight work may finish | Observe; do not claim rollback |
| Succeeded | Confirmed results, record links and draft/posted/sent distinctions | Open records or start a new request |
| Failed / expired / cancelled | What completed, failed and never started, plus actionable reason | Safe continuation if supported; otherwise inspect/manual completion |
| Reconciliation required | Outcome not yet verified; known references retained | Authorized inspection/reconciliation; never blind retry |
| Offline / reconnecting | Connection lost, persisted work may continue | Reconnect observation with same run/cursor |
| Quota / permission / configuration blocked | Distinct localized explanation without internal diagnostics | Scoped usage view, authorized settings, or contact administrator |

Every result/preview has enough shared structured data for UI and MCP parity: server-owned run/step/action identifiers, localized-label keys with safe parameters, business record type/reference, status, exact currency-aware values, permitted next actions, and safe error code. Persist execution authority separately from redacted/truncated presentation. Revalidate domain access for historical results and links. No generic Execute, Retry all or Undo button unless the backend implements that exact safe operation; compensating business actions require their own permissions and approvals.

## Administration usability

- Keep `/admin/ai` site catalog distinct from `/settings/ai` delegated organization configuration. Readiness reports safe status and blocker codes only within current permissions. Avoid a required fake organization for site-only actions; use the existing site-session authorization boundary.
- Present connection/configuration status separately from runtime availability: not configured, credential present, test not run, test failed, last successful test with configuration version/time, disabled, delegation withdrawn, or operator qualification required. Configuration/credential/model changes invalidate old readiness evidence.
- Progressive disclosure: normal setup uses approved defaults and friendly labels; advanced endpoint, timeout, model evidence and capability details remain accessible to appropriate admins. Never invent a recommended provider/model or price. Explain billing currency and price units alongside inputs; show saved vs unsaved state.
- Price versions and both member/org budgets are explicit prerequisites for a metered test. AI-011 supplies these forms; AI-024 provides readiness links and rechecks them. Entering settings never sends a provider request or flips deployment flags. A connection test is an explicit potentially metered action with a truthful cost/usage explanation.
- Keep non-secret edits on recoverable errors; inline field errors associate with controls and focus the first error. Do not remount unrelated dirty forms after saving another card. Explain version conflicts and allow reload/reapply without silently overwriting current server settings. Clear credential inputs immediately; never persist secrets to browser storage.
- Group tool policies by business domain and risk, with search, current effective access and reasons an option is unavailable. Explain the intersection of user, organization and agent permissions. No one-click permission expansion beyond reviewed operations. Show impact before saving sensitive changes; credential revocation and disablement use a concrete confirmation, preserving immediate access to operational Stop controls.

## Usage and operations

Separate My usage, permitted organization aggregates and site aggregates. Unsupported aggregate/filter/export capabilities must be implemented with matching authorization and MCP before UI claims them. Summary cards show period, timezone, observed usage, reserved/unknown usage and remaining quota; tokens and retry counts are secondary detail. Keep costs separated by billing currency, label them estimates, and disclose price version and rounding. Unknown is not zero, zero quota is not unlimited, and an unavailable price is not free usage.

Provide filter reset, meaningful empty/error/loading states, complete scoped pagination and exports matching filters. Show UTC quota-reset instant in the user's presentation timezone without changing the accounting period. Operations tables are useful without transcript snippets: localized status/reason, timestamps, duration and authorized actions. Budget edits explain organization/member scope, currency, monthly and per-run limits, rate/concurrency, and that lowering a limit never erases previous usage. Disabling execution or stopping work describes completed/uncertain effects honestly.

## Bilingual and accessibility acceptance

These are project acceptance targets, not a claim of certified compliance. Verify English/LTR and Persian/RTL using real presentation providers and existing light/dark themes. Reuse existing Persian typography and logical spacing. Isolate Latin record IDs/provider identifiers and mixed money text using the appropriate shared bidi primitives. Preserve canonical IDs, dates and exact minor-unit carriers; use existing locale parsers for supported Persian/Arabic digits and ask about ambiguous currency/date/toman input rather than silently converting units.

Exercise 360 px, 768 px and 1280 px layouts, 200% zoom, long Persian text, long IDs, large exact amounts and multi-currency results. No page-level horizontal overflow or clipped primary controls; wide report tables may have a labeled keyboard-reachable scroll region. Dialogs/drawers have names, sensible initial focus, focus containment and return, keyboard dismissal where safe, and no approval by accidental Enter. Ensure visible focus, non-color status cues, labeled controls, announced validation/status, reduced-motion behavior and at least 44 by 44 CSS-pixel primary touch controls. Check text contrast against project targets (4.5:1 normal, 3:1 large text) and controls/focus visibility in both themes.

The required real sensitive positive path is AI-016's existing submitted-expense approval: verify its exact posting effects in a disposable database after a concrete authorized decision. Mocked approval cards alone cannot qualify this journey. The task must split any additional implementation into a required child if necessary; unsupported payments/outbound actions remain honestly unavailable.

AI-028 records task success, wrong turns, unclear labels, recovery failures and resulting fixes for each journey. Include keyboard-only and screen-reader milestone checks, scoped users/admins, organization switching during delayed responses, long history and interrupted execution. No completion credit from static class/string assertions alone. Screenshots/golden comparisons are not required under DEC-005; use behavioral, rendered layout/accessibility and interaction evidence. Use an existing authorized runtime or available component harness; do not start a dev server or full build without applicable authorization. Clearly separate automated/component inspection, observed runtime behavior and native Persian review; never impersonate a human participant. Native linguistic and production gates remain in the existing release process.
