# MON-151 self-review 1

2026-10-12, Asia/Tehran. Reviewer/operator: codex. Kind: self. Decision: approve
within MON-151 only. Evidence: MON-151-attempt-1.md. No independent peer/human
review, browser session, hosted CI or production qualification is claimed.

Reviewed every changed consumer and helper/fixture, scoped git diff and regenerated
inventory paths. Verified monetary amounts require safe numeric carriers and
agreeing canonical aliases; bigint totals preserve low digits; selected report/base
currencies own display/input; rates, basis points, ordinals and physical counts
keep distinct units. All report fields are parsed before state adoption. CSV uses
raw exact strings with currencyCode. Settlement uses one parsing policy for
prefill/preview/write, nonnegative whole minor units, zero no-op compatibility,
base-bank selection and returned preview agreement. Backend tenant/role/locks,
filed state/account validation and rollout gate remain authoritative.

Approval read/input/save reuse shared field/operator/int64 validation, preserve
raw document thresholds and text/basis-point policy, and cannot override conflicting
aliases. Currency gains/losses retain nullable missing-rate behavior and separate
source/base presentation. Manual quotes retain the actual lossless int32-millionths
wire range; malformed/high-precision input fails instead of rounding.

Existing English flow, keyboard controls and responsive sheets remain. Source
review and static React preview tests satisfy DEC-005; interactive effects are
not independently exercised. Period data aborts on org/id changes and report
filters/drill generations reject obsolete replies. Optional shared AccountPicker
filters preserve unfiltered callers. General/tax/procurement controls have explicit
nonmoney ownership; no missing monetary editor is invented.

All 3 acceptance criteria are supported by the five behavior/render groups,
eight joint real REST/MCP/SQL suites, 471 pure tests, final typecheck/changed lint,
zero-error whole lint, money/legacy/controller/diff gates. The review corrected
report state ordering so every amount is validated before adoption. Remaining
exceptions are recorded in CORE_UI_MONEY_CUTOVER: implicit-base frozen history,
safe-number business bounds versus int64 condition thresholds, int32 quote range,
nonmoney controls and production IRR rejection. MON-133, MON-129 and MON-007 remain
open for independent combined acceptance. No required MON-151 work remains.
