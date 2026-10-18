# LOC-031 review 1 - honest Codex self-review

2026-10-18 (Asia/Tehran). Reviewer: Codex, same agent that implemented this task.
Kind: self. This is neither independent peer review nor human linguistic/RTL
approval. Reviewed the task-owned diff, production templates/helper, existing
import callbacks/parser/REST/MCP contracts, tests and attempt-1 evidence.

## Findings and resolution

- All authored copy in the actual imports page, ImportRow and ImportSheet is
  catalog-backed. Finite warning mappings cover all six current parser warnings;
  unknown warning prose uses a localized fallback. Static AST and render checks
  cover the owned slice. Technical formats and caller data have explicit exceptions.
- Preexisting locale namespaces and unowned shared declarations are identical
  to entry HEAD after line-ending normalization. The removed FORMAT_LABELS export
  had no callers outside ImportSheet; its typed replacement preserves all format
  values/technical labels and translates only automatic detection.
- The existing layout callbacks retain their exact implementation. Actual callback
  tests verify mode/format/content/file-name/org contracts, bigint preview adaptation,
  reset/refresh behavior and failed-request input preservation. Money/format parser
  regressions pass. No services/schema/migrations/REST/MCP/Stripe implementation changed.
- Initial encoding loss in the new catalog was corrected before final checks;
  every new Persian leaf now contains Persian characters. Matching keys and those
  checks establish catalog integrity, not terminology approval. Persian wording is
  explicitly provisional and full native/RTL qualification remains independent.
- No separate ImportHistoryTab or mapping/profile editor exists in the owned UI.
  Existing mapping/profile machine capabilities are preserved; adding an editor
  would exceed this extraction task. Parent integration remains independently open.
- Verification passed 25 focused and 747 full unit tests, catalog validation,
  typecheck, zero-error lint and money/legacy gates. Tests use real React/next-intl
  templates and callback syntax with controlled boundaries; no browser, database,
  hosted-CI, provider, deployment or production qualification is claimed.

No unresolved defect was found in this bounded presentation diff. Approve LOC-031
for controller completion and the user-authorized scoped commit/push. LOC-023/007/002
and native/RTL acceptance remain open. No human approval is recorded or implied.
