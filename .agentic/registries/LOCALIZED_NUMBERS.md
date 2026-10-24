# Exact localized numbers

LOC-003, 2026-10-24. This is the shared adapter/control foundation. Module-wide
adoption and bilingual workflow qualification remain with L10N-002 through
L10N-009; this does not declare every legacy formatter/input localized.

## Contracts

- `lib/money/localized.ts` remains the complete-value input boundary. Accept one
  Latin, Persian or Arabic-Indic numeral script per value. ASCII separators are
  decimal dot/group comma; Arabic separators are U+066B/U+066C. Callers explicitly
  choose the policy. Optional grouping requires a first group of 1-3 digits and
  subsequent groups of exactly 3. Leading ASCII plus/minus is allowed. Whitespace,
  bidi controls, labels, exponents, non-ASCII signs, mixed scripts, unexpected
  separators and arbitrary characters reject. No character-stripping parser.
- `parseLocalizedMajor` delegates to the existing exact money parser with
  explicit currency, rounding and signed int64 checks. Input `123456789` and
  `۱۲۳۴۵۶۷۸۹` both mean exactly `123456789` IRR minor units, without conversion,
  magnitude heuristics, toman support or new IRR activation.
- `i18n/numbers.ts` formats canonical exact decimal strings with every fraction
  digit/trailing zero retained. Intl receives the whole magnitude as bigint;
  fraction text is substituted in Intl parts with preferred digits. Only negative
  zero is passed as a numeric amount to preserve signs below one major unit.
  `formatExactMoney` obtains the ISO scale from the existing exact-money metadata
  and enforces int64 bounds. Neither function rounds or changes saved money.
- Numeral preferences are independent of language, calendar, timezone and
  currency. `latn` selects Latin digits and ASCII separators; `arabext` selects
  Persian digits and Arabic separators. Currency labels/sign placement come from
  Intl for the language. Formatters consume the presentation object; there is no
  process-global locale state. Canonical decimal output for APIs stays separate.

## Shared control adoption

- `CurrencyInput` displays preferred digits/decimal separator while keeping its
  controlled parent value, `onChange` callback and hidden named form field in
  canonical ASCII. Values remain strings; no amount goes through parseFloat or
  Number. Latin/Persian/Arabic-Indic input is accepted in either separator policy,
  but separators follow the selected numeral preference. A paste using the other
  separator policy rejects instead of guessing. Currency prefixes remain ISO
  codes. The text input retains decimal keyboard mode and explicit LTR direction.
- `normalizeDecimalDraft` uses the strict complete-value normalizer, with explicit
  unfinished states for editing: empty text, leading sign, decimal-only/trailing
  decimal or leading-decimal fractions. It enforces the caller's fraction-digit
  limit. These drafts are not financial values: existing domain validators must
  accept a complete amount before writing. Malformed edits leave parent state
  untouched, and existing range/sign/zero/currency policies remain authoritative.
- `DualAmount` uses `useNumberPresentation`, exact currency scales and bidi
  isolation for both source and base amounts, rejects unsafe numeric aliases,
  and preserves a missing base amount as unavailable. Display changes do not
  convert amounts or alter the base-currency availability policy.
- `bankMoneyDisplay` delegates to the same exact adapter, retaining English/Latin
  output by default for existing pure consumers. It accepts an explicit optional
  presentation object for module adoption. Fixed-two-place legacy domain helpers
  retain their documented units; changing their scale implicitly is forbidden.
- Existing `InvoiceAmountInput` validation runs on canonical parent strings and
  therefore retains positive-only, exact whole-minor-unit and compatibility-range
  guards. Its existing REST/MCP consumers receive the same canonical fields.

## Operation and qualification boundaries

No new user operation, REST route, MCP tool, schema, migration, catalog key,
permission, history/FX policy or rollout flag is introduced. The existing locale
preference REST/MCP operations already expose the numeral setting. General
Number-based compatibility helpers, raw numeric/percentage/count inputs, chart
geometry and output-specific formatters keep their existing contracts pending
the owning module tasks. Stripe files/functionality remain preserved under
DEC-008; no dedicated Stripe localization was performed.

Regression evidence: [attempt](../evidence/LOC-003-attempt-1.md) and
[Codex self-review](../evidence/LOC-003-review-1.md). Pure financial assertions,
real provider/control rendering and captured production input callbacks do not
claim mounted-browser cursor/IME/keyboard/hydration, native wording, full RTL,
PDF shaping, production IRR, provider delivery, hosted CI or release acceptance.
