#!/usr/bin/env bash
#
# check-architecture.sh — Backend NestJS Architecture Convention conformance
# Implements CHK-1..CHK-8 from
# specs/007-backend-module-restructure/contracts/structural-checks.md
#
# Usage:
#   scripts/check-architecture.sh [service]      # e.g. api | banking-ms | bff | ai-ms
#   scripts/check-architecture.sh --no-build     # skip CHK-8 build+test (structural only)
#
# Exits non-zero on any violation.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 2

SERVICE="${1:-}"
if [[ "$SERVICE" == "--no-build" ]]; then SERVICE=""; NO_BUILD=1; else NO_BUILD="${2:-}"; [[ "$NO_BUILD" == "--no-build" ]] && NO_BUILD=1 || NO_BUILD=""; fi

# Scope glob for src trees.
if [[ -n "$SERVICE" ]]; then
  SRV_GLOB="services/$SERVICE/src"
  [[ -d "$SRV_GLOB" ]] || { echo "unknown service: $SERVICE"; exit 2; }
  SRV_DIRS=("$SRV_GLOB")
else
  SRV_DIRS=(services/*/src)
fi

fail=0
note() { echo "$1"; fail=1; }

echo "== CHK-1: module anatomy (three flat files, only sanctioned subfolders) =="
for base in "${SRV_DIRS[@]}"; do
  for m in "$base"/modules/*/; do
    [[ -d "$m" ]] || continue
    n=$(basename "$m")
    for f in module controller service; do
      [[ -f "$m$n.$f.ts" ]] || note "MISSING: $m$n.$f.ts"
    done
  done
done
# no legacy layered folders anywhere in scope
while IFS= read -r d; do
  [[ -n "$d" ]] && note "LEGACY-FOLDER: $d"
done < <(find "${SRV_DIRS[@]}" -type d \( -name domain -o -name use-cases -o -name presentation -o -name persistence -o -name application \) 2>/dev/null)

echo "== CHK-2: no custom repositories remain =="
while IFS= read -r r; do
  [[ -n "$r" ]] && note "CUSTOM-REPO: $r"
done < <(find "${SRV_DIRS[@]}" -name '*.repository.ts' ! -name '*.spec.ts' 2>/dev/null)

echo "== CHK-3: controllers free of entities & repositories =="
while IFS= read -r c; do
  [[ -z "$c" ]] && continue
  if grep -nE "from ['\"].*/entities/|Repository<|@InjectRepository" "$c" >/dev/null; then
    note "CONTROLLER-VIOLATION: $c"
  fi
done < <(find "${SRV_DIRS[@]}"/modules -name '*.controller.ts' ! -name '*.spec.ts' 2>/dev/null)

echo "== CHK-6: class loggers present in controllers & services =="
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  grep -q "new Logger(" "$f" || note "NO-LOGGER: $f"
done < <(find "${SRV_DIRS[@]}"/modules \( -name '*.controller.ts' -o -name '*.service.ts' \) ! -name '*.spec.ts' 2>/dev/null)

# CHK-7 package boundary only meaningful at repo root (no per-service scope)
if [[ -z "$SERVICE" ]]; then
  echo "== CHK-7: package boundary (libs/ relocation, no frontend backend-lib imports) =="
  for p in auth config events logger observability; do
    [[ -d "packages/$p" ]] && note "STILL-IN-PACKAGES: $p"
    [[ -d "libs/$p" ]] || note "NOT-IN-LIBS: $p"
  done
  while IFS= read -r hit; do
    [[ -n "$hit" ]] && note "FRONTEND-BACKEND-IMPORT: $hit"
  done < <(grep -rEn "@finance/(auth|config|events|logger|observability)" apps/*/ --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v node_modules | grep -v '.next')
fi

if [[ -z "$NO_BUILD" && -z "$SERVICE" ]]; then
  echo "== CHK-8: builds & tests green =="
  if ! pnpm -r build >/tmp/arch-build.log 2>&1; then note "BUILD-FAILED (see /tmp/arch-build.log)"; fi
  if ! pnpm -r test  >/tmp/arch-test.log  2>&1; then note "TEST-FAILED (see /tmp/arch-test.log)"; fi
fi

if [[ "$fail" -ne 0 ]]; then
  echo "ARCHITECTURE CHECK: FAIL"
  exit 1
fi
echo "ARCHITECTURE CHECK: PASS"
