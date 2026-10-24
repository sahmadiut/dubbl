# LOC-003 Codex self-review - 2026-10-24

Reviewer: Codex `/root/task_001`, implementing agent. Kind: self. No independent
peer, native linguistic, human accounting or release approval is claimed.

Reviewed the final exact number adapter and draft policy, provider hook, shared
CurrencyInput/DualAmount adoption, bank display compatibility wrapper, regression
test, minimal older-test/provider bridge corrections, generated inventory and
documented module boundaries.

The formatter never converts an exact magnitude to Number. Whole values use
bigint with Intl grouping/currency/sign placement; only fraction parts receive
exact preferred-digit text. Negative subunits preserve their sign using numeric
negative zero, signed int64 money is checked through existing primitives, and
plain exact decimals retain all supplied fractional zeros. Currency scale comes
from the existing metadata, independently of locale or numeral preference.

Complete input retains the existing strict one-script/sign/separator parser.
Editing-only drafts cannot bypass later domain validation. CurrencyInput emits
canonical ASCII and retains canonical hidden form data, rejects whole malformed
edits, and does not swallow exceptions from the caller's onChange. Source and
base money retain their raw units and exact low digits. Unsafe numeric aliases
reject rather than round. Missing base amounts remain unavailable.

The new real-provider and captured-production-handler tests prove IRR equivalence,
four independent language/numeral combinations, low digits above the safe-number
edge, int64 limits, signed subunits, currency scales, preserved zeros, malformed
input, mixed scripts, canonical write values and unchanged callback state after
invalid edits. Older template fixture failures came from tsx's ESM/CommonJS
provider identities, fixed only in the test bridge; production's provider remains
required. Three older display assertions now expect preferred input numerals;
financial, date, currency and payload assertions were not weakened.

Final typecheck and changed-file lint pass; whole-repository lint has zero errors
and the existing 20 warnings. Catalog validation and both money guards pass,
retaining all 417 column classifications. Focused initial/final test results,
the two corrected old budget expectations, the successful 18-test budget/CRM
rerun, interrupted full-suite and resource-pressure retries are recorded honestly
in [attempt evidence](LOC-003-attempt-1.md). No full-suite pass is claimed.

Inventory regeneration also repairs four documented pre-existing stale consumer
records; the corresponding settings/onboarding/catalog source is unchanged.
No REST/MCP operation, schema/migration, stored unit/history/FX, permission,
currency activation or Stripe source change is introduced. Existing locale
preference operations cover the setting; remaining module-wide adoption belongs
to the scheduled L10N tasks, and native/RTL/browser/output/release qualification
remains separate. See [contracts](../registries/LOCALIZED_NUMBERS.md).

Result: approve the bounded LOC-003 shared numeric foundation. No task-owned
blocker remains. Complete controller closure and one local commit; the parent
supervisor handles fresh-agent continuation and the authorized two-commit push.
