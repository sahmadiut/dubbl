# Primary references to verify during execution

These pointers come from the supplied plan and were not newly browsed for this package. Record retrieved date, exact version/snapshot and relevant claim before using them. Inspect actual repository manifests first for compatible API/library versions. Do not rely on moving `current` or `latest` pages without recording the version.

| Topic | Primary pointer | Task |
|---|---|---|
| Dubbl project truth | Actual fork remotes, source, manifests, schemas and licenses | AUD-001 |
| Bigcapital public contracts | https://docs.bigcapital.app/api-reference/introduction | AUD-004 |
| License compatibility | https://www.apache.org/licenses/GPL-compatibility.html | AUD-003 |
| PostgreSQL exact types | https://www.postgresql.org/docs/current/datatype-numeric.html | MON-002..004 |
| Currency rules / regime | https://cbi.ir/exrates/rates_en.aspx and official operative publications | MON-009 |
| Locale data / plural rules | https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html | LOC-002 |
| Currency display digits | https://www.unicode.org/cldr/charts/45/supplemental/detailed_territory_currency_information.html (plan's version; verify chosen runtime) | MON-009 |
| next-intl | https://next-intl.dev/docs/usage/configuration | LOC-001 |
| ICU message syntax | https://formatjs.github.io/docs/core-concepts/icu-syntax/ | LOC-002 |
| Persian picker | https://daypicker.dev/v9/localization/persian (verify installed major version) | LOC-004 |
| Structural direction | https://www.w3.org/International/questions/qa-html-dir.en.html | RTL-001 |
| Radix direction | https://www.radix-ui.com/primitives/docs/utilities/direction-provider | RTL-001 |
| Logical CSS | https://tailwindcss.com/docs/margin | RTL-001 |
| Persian font and license | https://github.com/rastikerdar/vazirmatn | RTL-002 |
| PDF font/shaping | https://react-pdf.org/docs/v4/fonts (verify installed major version) | L10N-011 |
| Unicode security | https://www.unicode.org/reports/tr39/ | LOC-003 / QA-002 |
| Accessibility | https://www.w3.org/WAI/WCAG22/quickref/ | QA-003 |
| Security controls | https://owasp.org/projects/asvs | QA-002 |
| Visual / accessibility tests | https://playwright.dev/docs/test-snapshots and https://playwright.dev/docs/accessibility-testing | QA-003 |
| Provider availability | https://plaid.com/docs/institutions/ and https://stripe.com/global | DATA-006 / QA-002 |

News references or historical statements about planned redenomination are not an operational conversion rule. Obtain current official effective dates and accounting requirements before changing policy. Do not assume an official machine-readable CBI API from the existence of a rates web page.
