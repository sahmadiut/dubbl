# Verified repository map

Status: NOT YET INSPECTED. AUD-001 owns this file.

| Fact | Verified value | Evidence |
|---|---|---|
| Repository root | unknown | inspect locally |
| Fork HEAD / branch | unknown | git inspection |
| Upstream URL / baseline SHA | unknown | inspect configured remotes; do not assume |
| Existing user changes | unknown | sanitized git status |
| Package manager / lockfile | unknown | actual manifest and lockfile |
| Runtime / database versions | unknown | actual manifests, Docker and CI |
| Development / build / typecheck / lint | unknown | verified commands |
| Unit / integration / E2E commands | unknown | verified commands |
| Schema / migrations / ledger / API / MCP | unknown | actual file paths |
| Locale / UI / PDF / jobs | unknown | actual file paths |
| Deployment and feature flags | unknown | actual configuration |
| Previous implementation evidence | unknown | code, tests and commit references |

Do not run example application commands from the plan blindly. Record command working directory, prerequisites and observed outcome; preserve any baseline failure. Do not paste environment secrets or credential-bearing remotes.
