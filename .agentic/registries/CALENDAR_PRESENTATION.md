# Calendar presentation boundary

LOC-004 connects the existing independent calendar, timezone and numeral
preferences to the shared date picker. Language does not force a calendar:
English/Persian can each use Gregorian/Persian with Latin/Persian numerals.

## Date-only values

- `i18n/dates.ts` accepts only valid four-digit-year ISO Gregorian `YYYY-MM-DD`
  coordinates (years 0001 through 9999). Invalid/leap-overflow dates, timestamps,
  localized digits, slashes and formatted labels are not accepted as date-only
  inputs. There is no heuristic for guessing a calendar from an ASCII year.
- `dateOnlyToDate` carries a date at UTC midnight; `dateToDateOnly` serializes
  that UTC carrier. Use these only with the UTC-configured picker, not arbitrary
  local-midnight Date objects. They do not implement Jalali arithmetic.
- `formatDateOnly` uses Intl with explicit locale/calendar/numerals and UTC.
  The independent user timezone and host timezone cannot shift its date.
- `components/ui/calendar.tsx` selects the installed `react-day-picker` 9.14.0
  Gregorian or `react-day-picker/persian` implementation. Calendar-specific
  English/Persian locales supply month names and accessibility labels. Native
  DayPicker formatters, numeral conversion, selection and keyboard behavior are
  retained along with the existing styled day buttons and caller overrides.
- `components/ui/date-picker.tsx` always supplies UTC, formats the selected date
  through the date-only adapter and emits only ISO Gregorian strings through
  the existing `onChange`. Existing consumers retain their request contracts.
  Invalid controlled values show the existing placeholder, never a normalized
  date or `Invalid Date`. An empty selection retains existing callback behavior.

## Instants and persistence

- `formatInstant` uses the independent user timezone, calendar and numerals
  without mutating its Date. Notification date labels now reuse this adapter
  with their existing month/day options; relative-time/grouping policy is unchanged.
- Settings and `GET/PATCH /api/v1/user/locale-preferences` already expose calendar
  and timezone separately. Registered `get_locale_preferences` and
  `update_locale_preferences` use the existing scoped direct-DB service. No
  duplicate preference columns or calendar-specific business endpoints are needed.
- REST `/api/v1/entries` and registered `create_entry` continue accepting
  canonical Gregorian dates and rejecting formatted date labels. Calendar
  preferences never rewrite stored dates, timestamp instants, money or currency.
  No production REST/MCP/auth/schema/migration or financial logic changes.

## Verification and remaining qualification

- [Calendar tests](../../tests/calendar.test.ts): real provider and picker grids,
  captured real day-selection callbacks, independently varied language/calendar/
  numerals, Gregorian/Persian leap and New Year fixtures, host timezone changes,
  Tehran historical DST, malformed inputs and DatePicker callback/close behavior.
  The DatePicker portal is opened using a controlled SSR portal boundary only.
- [Existing locale fixture](../../tests/integration/locale-preferences.test.ts)
  and its [worker](../../tests/integration/locale-preferences-worker.ts) now also
  verify real business REST/registered MCP writes and independent SQL dates,
  timestamps and exact amounts. Preferences changes preserve saved rows;
  formatted date attempts make no journal writes.
- [Evidence](../evidence/LOC-004-attempt-1.md) and
  [self-review](../evidence/LOC-004-review-1.md) record actual commands and limits.

The installed library's `dist/esm/persian.js`, declaration and locale sources
were inspected for compatibility with the existing React 19/DayPicker 9 install.
The official [DayPicker changelog](https://daypicker.dev/changelog) documents the
v9 Persian entry point; current unversioned docs describe v10 packages, so no
dependency upgrade or new package was introduced. No external implementation
source was copied.

This is presentation-calendar work, not fiscal/statutory accounting-calendar
rules. Native linguistic, complete product-wide date extraction, mounted browser
keyboard/focus/portal behavior and full RTL/release qualification remain their
separate task gates. No browser, full build or development server was run.
