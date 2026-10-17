# LOC-005 attempt 1: catalog validation and preference extraction

## Identity and scope

2026-10-17 (Asia/Tehran), coding-assistant; D:/Projects/dubbl, master, entry
HEAD `4284505ef4d3147487723008378311b48f94289a`, clean entry tree. Live controller
selected LOC-002. Read root/.agentic instructions, START_HERE, CONTROLLER,
PROJECT/REPOSITORY_MAP, frontend role, requirements and LOC-001 implementation
and repair evidence. Source inspection found 388 app/components TSX files and
only two production translation consumers. Used the documented controller split
procedure to create LOC-005 through LOC-009, preserve parent criteria, validate,
split and start controller-selected LOC-005. No unrelated work was present.

## Implementation

- `i18n/catalog-validation.ts` validates module namespaces and every message with
  the pinned FormatJS parser: nonempty keys/values, key parity, ICU syntax,
  recursively collected argument kinds/formats, select options, plural categories,
  exact selectors/offsets and safe rich tags. Locale-specific ordinal categories
  are not incorrectly required to match English.
- `scripts/validate-messages.ts`, package command `i18n:check`, and CI test-job
  step make the catalog check executable. Parser dev dependency reuses version
  3.5.21 already present transitively; lockfile gains only the direct importer.
- `i18n/types.d.ts` types production namespaces/keys against the English catalog.
  `i18n/rich-text.tsx` maps approved tags to React nodes. ESLint rejects raw,
  markup, catalog-access imports and HTML sinks in translation modules, including
  direct catalog imports. Only root-provider `getMessages` transport is exempt;
  root HTML/raw rendering remains prohibited.
- Extracted the remaining six preference option labels into both catalogs;
  organization language options share them. English labels and all saved option
  values are preserved. Persian calendar names are provisional, not native review.
  UTC remains a technical timezone example. No REST/MCP/service/schema change.
- Added catalog contracts/ownership registry and parent/child planning links.
  Refreshed the generated money source inventory after the implementation settled.

## Acceptance mapping

1. Current catalogs: 17 keys per locale. Parser/shape tests reject missing/extra
   keys, invalid leaves, malformed ICU, incompatible names/kinds/formats, select
   options, exact cases and offsets. Typecheck negative probes enforce unknown
   production namespace/key rejection. Catalog parity is not a whole-product
   extraction claim; LOC-006 through LOC-009 and parent acceptance remain open.
2. Runtime tests: Persian cardinal 0/1/2 chooses one/one/other, fractional 0.5/1.5
   chooses one/other, ordinal cases choose other. English and explicit =0 cases
   are tested separately. React renders adversarial arguments as escaped text
   inside controlled rich nodes; HTML attributes/script/link/image/comment and
   ICU-quoted markup fail validation. Missing interpolation throws in the runtime
   fixture. Official CLDR/next-intl/FormatJS sources are linked in the registry.
3. Real preference component renders both catalogs with stable option values.
   Original locale/provider tests pass, as do the complete unit suite and
   typecheck. Diff inspection confirms that request methods/bodies, authorization,
   reload behavior and the existing locale REST/MCP operations are untouched.

## Verification

All commands ran from the repository root. Node v23.11.0, ICU 76.1, CLDR 46.0;
CI is configured for Node 22. No database fixture is needed for this UI/tooling
slice, and no application database was accessed.

| Command | Actual result |
|---|---|
| `pnpm add -D @formatjs/icu-messageformat-parser@3.5.21` | Exit 0; reused installed package; existing unrelated peer/deprecation warnings |
| `node --import tsx --test tests/message-catalogs.test.ts tests/locale.test.ts` final | Exit 0; 17 passed, zero failed/skipped |
| `pnpm test` final | Exit 0; 575 passed, zero failed/skipped |
| `pnpm typecheck` final | Exit 0; fumadocs-mdx plus tsc --noEmit, including negative key probes |
| `pnpm lint` | Exit 0; zero errors, 81 existing warnings |
| `pnpm exec eslint i18n/catalog-validation.ts i18n/types.d.ts i18n/rich-text.tsx scripts/validate-messages.ts scripts/eslint-safe-translations.mjs tests/message-catalogs.test.ts components/settings/locale-preferences.tsx 'app/(dashboard)/settings/page.tsx' eslint.config.mjs` | Exit 0; two existing Settings warnings, none in new code |
| `pnpm i18n:check` | Exit 0; 17 keys in both locales |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 1603 conservative consumer files |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; schema classifications, source hashes and occurrence lines verified |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| `python .agentic/agent.py validate` | Exit 0; 223 structurally valid tasks before final disposition |
| `git diff --check` | Exit 0 |
| `git fetch origin` and `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |

Initial typecheck exposed widened JS ESLint metadata typing; fixed with the actual
ESLint RuleModule annotation and reran typecheck successfully. Initial money
inventory check correctly reported changed-source drift; regeneration and final
verification passed. An interim PowerShell text-encoding issue in new labels was
caught by diff inspection, repaired with UTF-8 patches and covered by explicit
Persian label rendering assertions before final checks.

## Limits and handoff

No local build, dev server, Docker, browser, PDF/physical print, database migration
or hosted-CI success is claimed. Native linguistic approval, financial terminology,
full production-string extraction and RTL qualification remain later work. The
lint policy is a developer guard, not a security sandbox against deliberately
obfuscated JavaScript. See [self-review](LOC-005-review-1.md). Complete controller
disposition, commit task-owned files, push origin/master, verify remote parity and
clean status, report the controller's next task and stop.
