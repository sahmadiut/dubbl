# CI regression repair - locale font preference expectations

2026-10-18 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
The owner explicitly asked to inspect and fix the previous GitHub CI failure
before committing/pushing, and not wait for the next hosted run.

## Observed failure and cause

Inspected the fork explicitly with `gh ... --repo sahmadiut/dubbl`.
The latest completed failed [run 39089043264](https://github.com/sahmadiut/dubbl/actions/runs/39089043264)
is for `08fbc058205580cca9541c5ff5805aceb72bd46a`. Test, lint, typecheck and
controller jobs passed; PostgreSQL Migration Fixtures had 183 passing tests and
one failure. Its `shell-auth-settings` worker failed at line 59 because actual
locale preferences include `fontFamily: null`, absent from the old expectation.
The entry HEAD's run 39090006453 was still running at inspection; no conclusion
was inferred for that unfinished run.

Current `lib/api/locale-preferences.ts` explicitly returns `fontFamily` and
`i18n/locale.ts` resolves null to `vazirmatn`. The existing dedicated locale
fixture already checks both stored and resolved font behavior. The combined
shell/auth/settings fixture predates that additive contract and omitted both
fields from exact object comparisons. Application behavior is correct.

## Reproduction and fix

On a new loopback-only PostgreSQL 18 cluster, the unmodified
`node --import tsx --test tests/integration/shell-auth-settings.test.ts` failed
1/1 with the identical extra `fontFamily: null` diff. Fixtures create, migrate
and drop randomized `dubbl_ci_*` databases; no application database was used.

Changed only `tests/integration/shell-auth-settings-worker.ts`: expected REST
and MCP preferences now include null fontFamily, resolved presentation includes
the default `vazirmatn`, and an independent SQL assertion verifies the stored
null font and all four locale fields in each language. Exact deep equality,
team permission/tenant checks, persisted caller data and financial preservation
assertions remain in place. The original four-field PATCH payload is unchanged.
No runtime code, contract, workflow, timeout, gate or schema was changed.

Final local results are recorded in [LOC-057 attempt 1](LOC-057-attempt-1.md).
No claim is made that the next hosted run has passed. Push once local checks
pass and verify remote SHA; do not wait for hosted CI, per owner instruction.
