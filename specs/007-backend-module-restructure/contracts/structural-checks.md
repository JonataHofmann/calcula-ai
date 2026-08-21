# Contract: Automated Structural Conformance Checks

**Feature**: 007-backend-module-restructure

These are the verifiable checks backing the Success Criteria. They can be run as scripts/lint rules in CI (SC-001 requires an automated structural check). Each maps to a Success Criterion. Commands below are illustrative shell probes run from repo root; a task may harden them into a lint rule.

## CHK-1 — Module anatomy (SC-001)

For every `services/*/src/modules/<name>/`: the three flat files exist, and only sanctioned subfolders (`dto/`, `converters/`, `entities/`) are present.

```bash
# every module has the three flat files
for m in services/*/src/modules/*/; do
  n=$(basename "$m")
  for f in module controller service; do
    test -f "$m$n.$f.ts" || echo "MISSING: $m$n.$f.ts"
  done
done
# no legacy layered folders anywhere
find services/*/src -type d \( -name domain -o -name use-cases -o -name presentation -o -name persistence \) -print | sed 's/^/LEGACY-FOLDER: /'
```

**Pass**: no `MISSING:` and no `LEGACY-FOLDER:` lines.

## CHK-2 — No custom repositories remain (SC-006)

```bash
find services/*/src -name '*.repository.ts' -print | sed 's/^/CUSTOM-REPO: /'
```

**Pass**: no output.

## CHK-3 — Controllers free of entities & repositories (SC-002)

```bash
for c in $(find services/*/src/modules -name '*.controller.ts' ! -name '*.spec.ts'); do
  grep -nE "from ['\"].*/entities/|Repository<|@InjectRepository" "$c" && echo "  ↳ VIOLATION in $c"
done
```

**Pass**: no violations. (Business-logic absence is confirmed by review per C2, not greppable alone.)

## CHK-4 — Services access persistence only via injected repositories (SC-004)

Each persistence service uses `@InjectRepository(Entity)` + `Repository<Entity>` and imports no custom repository. Verified by CHK-2 (no custom repos exist) plus grep that services reference `@InjectRepository` where they persist. Gateway (bff) services are exempt (R4).

## CHK-5 — Response DTOs distinct from entities (SC-003)

Every controller return type is a `*Dto` and is produced through a converter; no endpoint returns an entity type. Verified by CHK-3 (no entity imports in controllers) + review that each response type lives in `dto/`.

## CHK-6 — Class loggers present (SC-005)

```bash
for f in $(find services/*/src/modules -name '*.controller.ts' -o -name '*.service.ts' | grep -v '.spec.ts'); do
  grep -q "new Logger(" "$f" || echo "NO-LOGGER: $f"
done
```

**Pass**: no `NO-LOGGER:` lines.

## CHK-7 — Package boundary (SC-Pkg)

```bash
# backend-only packages must no longer live under packages/
for p in auth config events logger observability; do
  test -d "packages/$p" && echo "STILL-IN-PACKAGES: $p"
  test -d "libs/$p" || echo "NOT-IN-LIBS: $p"
done
# no frontend source import of a backend-only lib
grep -rEn "@finance/(auth|config|events|logger|observability)" apps/*/  --include='*.ts' --include='*.tsx' \
  | grep -v node_modules | grep -v '.next' | sed 's/^/FRONTEND-BACKEND-IMPORT: /'
```

**Pass**: no `STILL-IN-PACKAGES:`, `NOT-IN-LIBS:`, or `FRONTEND-BACKEND-IMPORT:` lines.

## CHK-8 — Builds & tests green (SC-007)

```bash
pnpm -r build && pnpm -r test
```

**Pass**: all four services build; test pass count ≥ pre-migration baseline (api 37, banking-ms 18, bff 8, ai-ms 1), all co-located (FR-020).
