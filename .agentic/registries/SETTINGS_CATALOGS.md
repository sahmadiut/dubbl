# Settings configuration catalogs

LOC-014 is the core configuration child of LOC-012. Source inspection found 23
settings TSX files totaling over 10,000 lines, so LOC-012 now waits for LOC-014
through LOC-017 and retains independent integration acceptance. LOC-006 and
LOC-002 also retain their combined acceptance. LOC-013 owns teams, administration
and notifications outside the settings routes; settings notification preferences
belong to LOC-015, whose extracted scope and exceptions are recorded in
[settings automation catalogs](SETTINGS_AUTOMATION_CATALOGS.md).

## Extracted core scope

| Source | Catalog and behavior |
|---|---|
| `app/(dashboard)/settings/layout.tsx` | SettingsNavigation: all group and desktop/mobile link labels. Existing paths, active styling and detail-page navigation suppression retained. |
| `app/(dashboard)/settings/page.tsx` | SettingsGeneral: document title, sections, labels, placeholders, help, save/lock states, Gregorian fiscal month labels and PEPPOL scheme display. Reuses LocalePreferences and OnboardingOptions. |
| `app/(dashboard)/settings/procurement/page.tsx`, `components/settings/procurement-settings-form.tsx` | SettingsProcurement: all controls, descriptions and toast states. Form extraction preserves basis-point conversion, percent input constraints, switch values and save disabling. |
| `app/(dashboard)/settings/cost-centers/page.tsx`, `components/settings/cost-center-delete-description.tsx` | SettingsCostCenters: titles, table headings/statuses, drawer labels, placeholders, actions/errors and complete rich deletion confirmation. Conditional child warning and escaped code/name retained. |
| `app/(dashboard)/settings/tags/page.tsx`, `components/settings/tag-fields.tsx` | SettingsTags: document title, headings, empty states, table/form labels, actions/errors and all ten color tooltips. Existing hex colors, selected indicator and user data retained. |
| `i18n/settings-errors.ts` | SettingsErrors: exact allowlist for existing organization/tag/auth/permission/currency-history errors; unknown responses use operation fallback, validation statuses use input-check copy. No server prose echoed. |
| `i18n/settings-options.ts` | Typed payment-term catalog labels with original enum values. Address-country CLDR labels are display only, with canonical English fallback. |
| `app/(dashboard)/settings/loading.tsx`, `components/settings/locale-preferences.tsx` | Composition/already catalog-backed by LOC-011/LOC-005; audited, no duplicate namespace. |

At completion, 213 keys were added in six Settings namespaces, for 748 matching
keys in each production catalog. All Persian wording is **provisional** and still
requires native linguistic/financial review. RTL and full settings integration
are not accepted by this task.

## Explicit exceptions

| Data/literal | Reason and boundary |
|---|---|
| Legal entity `localName`/`englishName` | Jurisdiction reference names and abbreviations remain verbatim, as in LOC-010. They are not approved Persian legal equivalents. |
| Address-country names | Runtime `Intl.DisplayNames` CLDR region data instead of a duplicate 192-country catalog. en-US preserves existing reference names; unsupported runtime/unknown codes preserve supplied canonical labels. Business-country labels reuse the 40 existing OnboardingOptions keys. |
| Country codes/names, business-type codes, currency codes, PEPPOL scheme values | Write/storage identities remain canonical. Selecting a country still stores its original English name/code and currency; search accepts Persian labels, canonical names and ISO codes. |
| Gregorian month values and date input | Fiscal month values remain `1` through `12` and the displayed names remain Gregorian. Lock date input and interpolation keep canonical date strings. Calendar/date/numeral adapters remain separate tasks. |
| Stripe, PEPPOL, EAN/GLN and scheme abbreviations | Provider/network/reference identities retain spelling. Surrounding copy is translated; identical technical scheme labels still have catalog keys. Existing provider/legal guidance is preserved without a new compliance claim. |
| Email/URL/phone/postal samples, ISO IDs and hex colors | Technical samples and identifiers retain characters. Samples have matching catalog keys; colors/values never depend on translation. |
| Organization names, cost-center codes/names, tag text and descriptions | User data remains verbatim and React-escaped. Rich confirmation allows only reviewed tags. |
| `%`, separators, numeric counts and blank/dash placeholders | Nonlinguistic symbols/data retain existing display behavior. Percent conversion is nonmonetary and unchanged. |
| Native browser constraint validation | Browser-owned messages retain required/type/min/step behavior. No custom validation language is introduced. |
| Unknown API/network error prose | Never interpreted as catalog keys or displayed as translated product text. Generic/input-check fallback retains operation context; REST/MCP output is untouched. |

## Remaining settings ownership

- LOC-015 is extracted; see the linked automation inventory for its independent
  verification and remaining native/RTL limitations.
- LOC-016: members, roles, advisors, API keys and audit log.
- LOC-017: billing, Stripe, document templates, import/export (including the bulk
  import wizard), backups and trash.
- LOC-012: independent combined settings acceptance after all four children.
- LOC-006 / LOC-002: independent shell/settings and product-wide catalog acceptance.

No REST handler, domain service, authorization, schema or MCP tool changed. Existing
organization/period-lock/procurement/cost-center/tag operations retain their MCP
counterparts. No new user operation was introduced by message extraction.

## Verification and limits

`tests/settings-catalogs.test.ts` uses real React/next-intl rendering for the
layout, general page, procurement form, tag fields, cost-center confirmation and
initial tag/cost-center pages. It checks paths/detail branching, field values,
save disabling, percent units, conditional warning, escaped user text, color
identities, all country/payment options, fallback behavior and bounded JSX
extraction. Catalog/locale tests cover ICU contracts and provider resolution.
These are rendering/behavior assertions, not browser click or layout acceptance.

During review, the existing period-lock GET reader was observed using `data.lock`
while the REST handler returns `periodLock`. This pre-existing behavior was left
unchanged in this presentation slice; independent parent acceptance must assess
it. No period-lock persistence correctness claim is made here.

See [attempt 1](../evidence/LOC-014-attempt-1.md) and
[self-review](../evidence/LOC-014-review-1.md) for final commands and limitations.
