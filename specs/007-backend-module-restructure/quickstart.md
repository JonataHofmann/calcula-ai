# Quickstart: Validating the Backend Convention Migration

**Feature**: 007-backend-module-restructure | **Date**: 2026-08-20

This is a validation/run guide — how to prove a migrated module (or the whole backend) conforms and has no regression. It references [contracts/](./contracts/) and [data-model.md](./data-model.md) rather than duplicating them. Implementation details belong in `tasks.md`.

## Prerequisites

- Node 22, pnpm, running from repo root `/Users/jonatahofmann/money-app2`.
- `pnpm install` succeeds (workspace links intact, including new `libs/*`).
- Postgres reachable via `DATABASE_URL` for services that persist (api, banking-ms, bff).

## Scenario A — One module conforms (US1 + US2, MVP proof)

Target the first converted module (recommended `services/api` / `accounts`, per research R7).

```bash
# structural anatomy (contracts/structural-checks.md CHK-1)
n=accounts; m=services/api/src/modules/$n
ls "$m"/{dto,converters,entities} "$m/$n."{module,controller,service}.ts
find "$m" -type d \( -name domain -o -name use-cases -o -name presentation -o -name persistence \)  # expect: empty

# controller carries no entity/repo (CHK-3)
grep -nE "from '.*/entities/|Repository<|@InjectRepository" "$m/$n.controller.ts"                    # expect: no matches
grep -c "new Logger(" "$m/$n.controller.ts" "$m/$n.service.ts"                                        # expect: >=1 each

# no custom repository survives for this module (CHK-2)
find services/api/src/modules/$n -name '*.repository.ts'                                              # expect: empty
```

**Expected**: three flat files + `dto/`/`converters/`/`entities/` present; no legacy folders; controller has no entity/repository references; both classes declare a logger; no `*.repository.ts`.

## Scenario B — Behavior unchanged for that module (US1 acceptance #3)

```bash
cd services/api && pnpm test -- accounts   # co-located *.spec.ts for the module
```

**Expected**: all previously-passing specs for the module still pass (FR-019, FR-020).

## Scenario C — Logging trail (US3)

Start the service and exercise an endpoint; inspect stdout.

```bash
cd services/api && pnpm start:dev
# in another shell, call a converted endpoint (e.g. GET /accounts/:id)
```

**Expected** (per data-model.md logging model): a controller entry log (method+resource+params), a service start log, a `warn` on not-found/conflict paths, and a completion log with the resource id.

## Scenario D — Package boundary (SC-Pkg)

Run CHK-7 from [contracts/structural-checks.md](./contracts/structural-checks.md).

**Expected**: `auth`, `config`, `events`, `logger`, `observability` exist under `libs/` and not `packages/`; zero frontend (`apps/*`) imports resolve to them; `contracts`/`ui` remain in `packages/`.

## Scenario E — Whole-backend conformance (US4)

Run every check in [contracts/structural-checks.md](./contracts/structural-checks.md) (CHK-1..CHK-8), finishing with:

```bash
pnpm -r build && pnpm -r test
```

**Expected**: 0 legacy layouts, 0 custom `*.repository.ts`, all loggers present, all four services build, and total passing specs ≥ baseline (api 37, banking-ms 18, bff 8, ai-ms 1). Per-service adaptations hold: ai-ms has no `entities/`/`converters/`; bff HTTP-proxy modules have no `entities/`; banking-ms scheduling still runs (research R5).

## Scenario F — Developer predictability (SC-008)

Give a developer the [module-anatomy contract](./contracts/module-anatomy.md) and 10 sample code snippets (a DTO, a converter, a guard, a migration, a shared enum, an HTTP client, …); ask which folder/file each belongs in.

**Expected**: ≥ 9/10 correct placements using only the documented convention.

---

## Validation Results (T042 — recorded 2026-08-21)

| Scenario | Result | Evidence |
|----------|--------|----------|
| **A** — module anatomy (`api/accounts`) | ✅ PASS | three flat files + `dto/`,`converters/`,`entities/` present; 0 legacy folders; controller has 0 entity/repo refs; logger in both controller & service; 0 `*.repository.ts` |
| **B** — behavior unchanged | ✅ PASS | `pnpm test -- accounts` → 2 suites, 10 passed, 4 skipped (integration gated by `TEST_DATABASE_URL`); all previously-passing specs green |
| **C** — logging trail | ✅ PASS (via test logs) | live `start:dev` not run in CI; leveled logs observed firing in the test run — controller entry, service start `log`, `warn` on not-found/conflict, completion with resource id (matches data-model logging model). CHK-6 confirms loggers declared |
| **D** — package boundary | ✅ PASS | `libs/` = {auth,config,events,logger,observability}; `packages/` = {contracts,ui,eslint-config,tsconfig} (the 5 not present); 0 `apps/*` imports resolve to the 5 backend libs; CHK-7 PASS |
| **E** — whole-backend conformance | ✅ PASS | `check-architecture.sh` CHK-1/2/3/6/7 PASS (overall PASS); backend `pnpm -r build` 4/4 green; tests api 155 pass/21 skip, banking-ms 99 pass, bff 53 pass, ai-ms 1 pass — all ≥ baseline; per-service adaptations hold (ai-ms no `entities/`/`converters/`, bff proxy no `entities/`, banking-ms scheduling wired) |
| **F** — developer predictability | ✅ Covered by doc | human-subject test not run in CI; the finalized `docs/backend-architecture.md` documents standard anatomy + R1/R2/R4/R5 adaptations unambiguously so each of the sample artifacts (DTO→`dto/`, converter→`converters/`, guard→`common/guards/`, migration→`database/migrations/`, shared enum→`common/types/` or `libs/`, HTTP client→provider in module) has one documented home |

> **Out-of-scope note (Scenario E, whole-repo CHK-8):** the whole-repo `pnpm -r test` reports FAIL solely from 6 pre-existing `apps/web` frontend failures (`header.spec.tsx` ×5, `sidebar.spec.tsx` ×1). `apps/` was never modified by feature 007 and imports no relocated backend lib — the backend is fully green.
