# AI agent and administration delivery plan

Current scope update (DEC-010, 2026-10-27): phase 12, Iran business capabilities, runs after phase 7 and before phase 5. New tax work is excluded. Open phase-5 tasks and QA-001 depend on IRN-001. See the Iran business delivery plan in docs/IRAN_BUSINESS_PLAN.md (relative to .agentic). AI remains next; phase-5 scope is retained for later reconsideration.

Requested by the project owner on 2026-10-17. This is a backlog and architecture proposal, not an implemented feature or deployment approval. Requirements: [owner extension](../sources/SOURCE.md#ai-agent-and-administration-owner-extension). Task status is authoritative in `../tasks/AI-*.md`.

AI-001 source baseline and normative implementation inputs (2026-10-27):
[capability/gap matrix](../registries/AI_CAPABILITY_MATRIX.md),
[reproducible operation inventory](../registries/AI_CAPABILITIES.json), and
[execution contract v1](AI_EXECUTION_CONTRACT.md). No chat tools or live provider
are enabled. Provider/model selection remains unresolved pending verified
deployment/account availability and data handling; subsequent engineering can
use deterministic fixtures while those live-qualification gates remain closed.

## Product outcome

A user can ask the assistant to find a customer, inspect relevant records, prepare several documents and summarize the results in one conversation. The assistant executes a bounded sequence of authorized tools, observes each result and continues until complete, awaiting clarification/approval or explicitly stopped. It must report partial completion truthfully and link to actual records. It must never claim an action succeeded solely because the model described it.

The target is coverage of existing site capabilities within user permissions. Support must be measured against an operation inventory; registering every current MCP tool does not prove complete site coverage. Missing operations require bounded implementation tasks and corresponding MCP tools. No arbitrary database, shell or browser control is implied.

Administrators manage provider connections, API credentials, models, policies, quotas and monitoring. Users receive only the chat, history, usage and management capabilities they are allowed to access.

## Historical source findings (2026-10-17 baseline)

- `lib/mcp/tools/index.ts` and `lib/mcp/server.ts` provide an established registry and organization-bound `AuthContext`. Existing shared services under `lib/api/` should supply business behavior rather than duplicating accounting logic.
- `lib/api/auth-context.ts`, `lib/api/require-role.ts` and `lib/plans.ts` establish session/API-key identity and role/custom-permission checks. `lib/mcp/errors.ts` supplies error and exact-money serialization behavior.
- `lib/mcp/auth.ts` currently falls back to a token role when membership is missing and does not resolve custom-role permissions. The API-key path in `auth-context.ts` also falls back when its creator's membership is missing. AI-002 must address and test relevant identity paths before exposing them to the agent. These are source findings, not demonstrated exploits or a complete security audit.
- `lib/api/require-site-admin.ts`, `app/api/v1/admin/` and `app/(admin)/admin/` provide existing site-administration boundaries and navigation. Global administration must remain separate from organization roles and organization-scoped API/MCP credentials.
- `package.json` declares Next.js, Drizzle/PostgreSQL, MCP and next-intl. No dedicated agent runtime/provider SDK is declared, and the targeted source search found no established AI chat implementation to extend. Verify again during AI-001.
- These findings describe the 2026-10-17 planning baseline; verify current source during AI-001. The 2026-10-27 scheduling change starts no implementation task and changes no application files.

## Current planning review (2026-10-28)

The owner requested a complete AI task review and direct improvements for UI/UX, ease of use and professional workflows. The normative [product experience contract](AI_PRODUCT_EXPERIENCE.md) now defines first use, business requests, approvals, recovery, reports and administration. See the [review findings](../evidence/AI-product-experience-review-2026-10-28.md) for the inspected baseline and task mapping.

The inspected tree contains provider/policy management UI, shared persistence/provider/usage/tool services and lifecycle primitives. The ordinary conversation UI and actual worker/model loop still require the open tasks. Existing admin forms expose configuration fields but do not yet supply a complete readiness journey across price and member/org budget prerequisites. These are source-level findings, not an observed browser evaluation. Historical completed tasks/evidence remain intact; AI-024/025 own their additional product requirements.

AI-009 is now an integration parent for AI-026 workspace/history and AI-027 action/approval/recovery UI. AI-011 includes the existing price/budget services' administration forms so setup has no hidden API-only prerequisite. AI-024 depends on AI-011 for those prerequisites; AI-025 improves policy comprehension and settings safety. AI-028 independently qualifies assembled journeys and depends on all eight finite domain follow-ups AI-014..021. AI-012 depends on AI-028, so AI-013 transitively gates every current AI task. The previously missing domain dependencies are now explicit.

This review changes planning only: no provider choice, production enablement, live test, native-language approval or implementation completion is claimed. Technical work can use deterministic fixtures while deployment-specific live-provider qualification remains an explicit enablement requirement. Phase order, deferred phase 5, frozen Stripe scope and no-new-tax scope are unchanged.

## Architecture boundaries

1. The chat UI calls authenticated run/conversation services. Resolve actor and organization from trusted server state; model-generated arguments cannot choose identity or widen scope.
2. A durable executor owns the bounded model/tool loop. Persist run and step events, enforce budgets, handle reconnect/cancellation and reconcile uncertain side effects after a crash. Select the actual worker/runtime mechanism during AI-001 after checking existing deployment constraints; a browser connection is not the lifetime of a run.
3. A tool dispatcher exposes an allowlisted subset of existing MCP contracts and shared domain services. Revalidate current authorization for every call and after approvals. Filter tool discovery for usability and enforce authorization again server-side. Use direct shared services/Drizzle conventions, not HTTP self-calls.
4. Provider adapters normalize streaming, tool calls, errors, usage and model capabilities. Keep provider/model configuration versioned. Capability checks reject unsupported models instead of silently degrading action semantics. Approved endpoint policies must prevent SSRF, redirect-based credential disclosure and unapproved fallback providers.
5. Usage services reserve budgets atomically before model requests and reconcile actual usage afterward. Include failed/retried attempts and flag missing usage. Use versioned prices and exact cost arithmetic; cost is an estimate with an explicit currency, not a provider invoice or automatic accounting entry.
6. Configuration services store encrypted credentials server-side. Provider credential plaintext is never available to the model, transcript, analytics export or browser. Dedicated administration APIs/MCP tools exist, but are not discoverable by the ordinary chat agent. Platform operations cannot become global through an organization-scoped credential.

Keep business amounts in the existing canonical minor-unit contracts with explicit currency; do not force every currency into two decimals or allow the model to perform ledger arithmetic. Existing exact-money, currency-readiness, period-lock, idempotency and domain-approval rules remain authoritative.

## Permissions and user experience

AI access is an additional restriction, never a substitute for a domain permission. AI-001 defines permission names consistent with `lib/plans.ts` and custom roles for chat use, own history/usage, organization usage, transcript audit, policy/budget management and provider management. Organization administration does not imply site administration, and aggregate usage access does not imply access to private transcripts.

Read operations and allowed draft preparation can proceed automatically. Sensitive operations such as posting, payment, deletion, external sending or access changes require a concrete preview and an approval permitted by policy. Bind approval to exact arguments, actor, organization, resource version and expiry. An explicit batch approval can authorize several displayed actions; the assistant cannot approve itself or bypass an existing business approval workflow.

Show action progress, pending approvals, records created, errors and final outcomes. Do not expose private model reasoning. Provide English and Persian catalogs, RTL, keyboard access and safe model-output rendering. Summarization or context truncation must preserve unresolved approvals, execution results and permissions as server state, not rely on a conversational summary for authority.

## Delivery order and acceptance

Current owner decision, 2026-10-27 (DEC-009): implement AI now and postpone phase 5 until afterward. This supersedes the 2026-10-17 low-priority scheduling instruction. AI-001..013 retain phase ID 11 and priority 2; the controller schedules phase 11 immediately after phase 4 and before phase 5. AI-001 keeps its already-completed technical prerequisites and no longer depends on unfinished parity, translation, IRR, QA/release or maintenance tasks. The owner subsequently clarified that phase 5 should move further back and may be deleted later. Schedule AI, phase 6, phase 7, then phase 5 before release qualification. Every open phase-5 task depends on AI-013 and L10N-012. Remove phase-5 ordering dependencies from phases 6 and 7 so they can work on existing capabilities; keep phase-5 tasks queued without deleting them. Previously skipped scope remains deferred. AI's internal dependencies and all financial, authorization, native-review and production-release requirements remain intact. Implementation and default-off integration acceptance can proceed before the wider release; actual enablement still requires the applicable qualification and release approvals. No provider selection, credential purchase, deployment date or cost estimate is invented here.

| Tasks | Deliverable |
|---|---|
| AI-001 | Inventory, architecture and provider capability contract |
| AI-002 | Current identity, role/custom permission and tenant enforcement |
| AI-003 | Conversation/run/step persistence and migrations |
| AI-004 | Provider adapters and secure configuration REST/MCP services |
| AI-005 | Usage, exact estimated cost and concurrent budgets |
| AI-006 | Permission-aware tool dispatch and site coverage matrix |
| AI-007 | Durable multi-step execution and recovery |
| AI-008 | Concrete action previews and approvals |
| AI-009 | Bilingual accessible chat and history |
| AI-010 | Provider/model/policy administration UI |
| AI-011 | Scoped usage and operations dashboard |
| AI-012 | Security, accounting workflow and reliability qualification |
| AI-013 | Independent integration acceptance and controlled rollout |
| AI-014..021 | Finite domain candidates, operation-level gaps and concrete user scenarios |
| AI-022 / AI-023 | Lifecycle primitives / actual metered runtime, clarification and presentation contracts |
| AI-024 | Guided provider setup and scoped readiness |
| AI-025 | Understandable tool policies and safe settings edits |
| AI-026 / AI-027 | Chat workspace/history / action, approval and recovery interactions |
| AI-028 | Integrated bilingual usability and accessibility qualification |

Each implementation task needs meaningful tests, actual evidence and controller review. AI-012 uses deterministic provider fixtures for failure/concurrency coverage and a separately recorded configured-provider smoke test before enablement. Source/provider behavior, pricing and deployment availability must be checked against current official documentation at implementation time. Mocked success does not qualify live provider operation.

AI-013 depends transitively on every feature task and remains open until independent integration acceptance. Keep the feature default-off until qualification; preparing it does not authorize deployment. Existing accounting, linguistic, security and general release gates remain applicable. If a task proves too broad, use the controller's child-task/split workflow; do not declare complete coverage with known missing operations.

## Operational scope

Include per-user and organization limits, max steps/context/output/time, request concurrency, retention/deletion, redacted audit trails, provider errors/latency, active-run cancellation and a kill switch. Disablement stops new dispatch and terminates active runs at safe boundaries; already completed external effects remain recorded. Final rollout evidence must document backup/migration behavior, provisioning, deployment/runtime compatibility, rollback and support procedures.

This feature does not add general web browsing, arbitrary external connectors, autonomous scheduled work, fine-tuning, embeddings/RAG infrastructure or permission to change site capabilities. Such additions need their own justified scope. The present request is for an interactive agent over the site's existing authorized capabilities.
