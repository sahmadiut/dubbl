# AUD-002 attempt 1: baseline preparation and runtime blockers

## Identity

2026-10-02, Asia/Tehran. Operator: coding-assistant (Codex). Repository D:\Projects\dubbl, HEAD eda9340939aa1d7674e3ee5a967f52ab45485ac2. Clean tracked working tree at entry. Windows PowerShell; Node 23.11.0, npm 11.3.0, pnpm 10.30.3, Python 3.13.9. Dependencies and generated artifacts already exist. No secret files or customer data read.

## Audit result

Claimed the controller-selected AUD-002 after validation and inspection of dependency evidence. Inspected package.json, Dockerfile, docker-compose.yml, CI, lib/db/seed.ts, health and financial report routes. Added docs/BASELINE_RUNBOOK.md with isolated fixture prerequisites, synthetic postings, expected report balances, before/after fiscal-close expectations and capture procedure. No application/schema/MCP changes or DB writes were made.

Root AGENTS.md forbids full builds and permits dev startup only on explicit request. A generic continue request does not override either rule. Dockerfile executes pnpm build, so container production reproduction is also prohibited. Docker and psql are absent from the current PATH. A preexisting service accepts connections at localhost:3000 and another at localhost:5432; this does not identify the database or prove fixture isolation. The seed script selects an existing owner's organization if present, so it was not run against the unidentified local database.

## Acceptance mapping

1. Exact commands, host versions and available observed outcomes recorded below. Full development startup, clean installation and production Docker reproduction remain unverified; criterion left unchecked.
2. Synthetic fixture expectations prepared in the runbook, but no actual trial balance, AR/AP, bank balance or retained earnings output captured; criterion left unchecked.
3. Unavailable/unverified integrations recorded below without claiming success; criterion supported by this evidence.

## Verification

All commands ran from D:\Projects\dubbl.

| Command/procedure | Actual result | Limitation |
|---|---|---|
| `python .agentic/agent.py validate`, `status`, `context` | Exit 0; 60-task graph valid; AUD-002 selected | Structural validation only |
| `git status --short`, `git rev-parse HEAD` | Clean at entry; SHA above | Audit changes remain uncommitted |
| `node --version`, `npm --version`, `pnpm --version`, `python --version` | Versions above | Node differs from Node 22 in CI/Docker |
| `Get-Command docker,psql -ErrorAction SilentlyContinue` | Neither command found; measured count 0 | Lookup absence does not prove software is not installed elsewhere; inspection wrapper exit 1 |
| `Test-NetConnection localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue` and same for port 3000 | Both True | TCP only; no DB query or startup performed |
| `npx tsc --noEmit` | Exit 0 | Existing generated sources; not a production build |
| `npm test` | Exit 0; 44 passed, 0 failed | Pure-function suite; no DB/UI/provider qualification |
| `npm run lint` | Exit 0; 0 errors, 167 warnings | Existing warnings retained |
| Initial `node -e` health probe | Exit 1; PowerShell/native quoting removed URL quotes, producing SyntaxError | No request sent; replaced with native PowerShell probe |
| Stopwatch around `Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -TimeoutSec 15 -UseBasicParsing` | HTTP 200, body `{"status":"ok"}`, elapsed 1567 ms | One sample including client overhead; static route, no DB readiness or warm-performance claim |
| Source inspection | Confirmed Node 22 frozen-pnpm Docker/CI setup; Compose web auto-pushes/seeds/starts dev; seed can reuse owner org | Source inspection is not execution |

Not run: full builds/Docker builds, dev startup, installs, migrations, db:push, seed, database queries, authenticated reports, screenshots, fiscal close, deployments or provider calls. No PostgreSQL version was queried. Stripe, S3/MinIO, Trigger.dev, SMTP and FX providers remain unverified; no credential inspection or external calls were performed. Docker runtime is unavailable on PATH.

## Review

Self-inspection by coding-assistant only. The 125000 pre-close trial balance, 117000 post-close balance, 15000 AR, 5000 AP, 102000 bank and 12000 earnings are mathematical expectations, not observed application results. Reject completion until actual captures and runtime reproduction exist. No peer/human review or approval claimed.

## Handoff

AUD-002 remains incomplete. Resume after obtaining explicit dev-start permission and a specific exception to the build ban for the required production Docker baseline, plus an available Docker environment and a confirmed disposable DB target. Follow BASELINE_RUNBOOK.md, retain sanitized actual outputs/screenshots/timings, and append attempt 2. Do not replace the untouched application baseline or seed existing customer organizations.
