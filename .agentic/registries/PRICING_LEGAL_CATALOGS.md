# Public pricing and legal catalog inventory (LOC-127)

PublicPricingLegal owns 268 paired messages across pricing, privacy, terms,
LegalPageLayout and its supporting LegalToc. LegalToc's two labels are included
so the shared legal chrome is bilingual. Its observer, active-section tracking,
smooth scroll, mobile state/close callbacks and cleanup are preserved.

Static legal sections are built within translation context. Complete paragraphs
and list items preserve strong markup through approved rich tags. Fixed links
are supplied by reviewed component callbacks using the approved em placeholder;
catalogs cannot choose destinations. Pricing heading, counts/limits, billing
period descriptions, storage tier actions and update-date label are complete
messages, allowing Persian word order. Billing interval buttons expose their
existing selection through aria-pressed. No new billing operation is added.

## Fixed exceptions and contracts

- Stripe passages remain verbatim: privacy payment-data, processing-purpose and
  independent-controller list items, and terms' entire Stripe payment/terms-link
  list item. DEC-008 remains in force; no Stripe-specific translation or repair.
- Company/authority fact blocks remain verbatim, including surrounding labels:
  Mindroot Ltd; Company No. 16543299, registered in England and Wales;
  registered office/address 71-75 Shelton Street, London, England, WC2H 9JQ;
  ICO Registration: ZB958997; Information Commissioner's Office; Wycliffe House,
  Water Lane, Wilmslow, Cheshire, SK9 5AF; Telephone: 0303 123 1113; Website:;
  Contact:; ico.org.uk; team@dubbl.dev. No legal entity/jurisdiction/contact facts
  are inferred from the Persian locale or rewritten for Iran.
- The literal last-updated value 2 March 2026 remains unchanged. All numeric
  periods, ages, notice/cooling-off windows, legal article/year references,
  URLs and 14 privacy/16 terms section IDs remain fixed. Persian numeric facts
  are asserted against their paired English messages.
- PLAN_LIMITS, PLAN_PRICES and STORAGE_PLANS remain untouched. Plan keys free,
  pro, starter, growth and scale, Infinity handling, flag/limit matrices,
  monthly/annual selection, dollar symbols/amounts, annual multiplication,
  storage MB/GB conversions and /sign-up?plan=pro are preserved.
- Existing toLocaleString() numeral presentation and MB/GB symbols remain as
  before. Locale-aware numeral/currency/date formatting belongs to LOC-003.
- Page metadata remains unchanged for LOC-128. CSS, animation data and technical
  identifiers are not display-message keys.

## Limits and parent scope

Translations are provisional, including legal terminology. This extraction does
not provide native/legal review, certify legal/service claims, adapt jurisdiction
or verify current statutes. No browser/keyboard, full RTL, provider, deployment or
production acceptance is implied. No build/dev server was run. The task adds no
REST/MCP operation or database change; existing APIs/tools remain intact.
LOC-122, LOC-009 and LOC-002 remain independent integration acceptance tasks.
