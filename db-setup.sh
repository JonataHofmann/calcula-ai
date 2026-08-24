#!/usr/bin/env bash
#
# Roda todas as migrations de todos os serviços + seeds.
#
# Uso:
#   ./db-setup.sh
#
# Requer o Postgres no ar (docker compose up postgres) e o DATABASE_URL
# no .env apontando para o host acessível a partir da máquina (localhost em dev).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Carrega o .env da raiz (DATABASE_URL etc.).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERRO: DATABASE_URL não definido (.env)." >&2
  exit 1
fi

echo "==> DATABASE_URL: ${DATABASE_URL}"

# Cada serviço tem schema próprio (api=public, banking-ms=banking, bff=bff).
# O TypeORM tenta criar a tabela de controle "<schema>".migrations ANTES de
# rodar a migration, então garantimos os schemas aqui (usa o driver pg já
# instalado, sem depender de psql/docker).
echo ""
echo "==> garantindo schemas 'banking' e 'bff'"
# pg é resolvido a partir do node_modules do banking-ms (pnpm não hoista p/ raiz).
( cd services/banking-ms && node -e '
  const { Client } = require("pg");
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect()
    .then(() => c.query("CREATE SCHEMA IF NOT EXISTS \"banking\""))
    .then(() => c.query("CREATE SCHEMA IF NOT EXISTS \"bff\""))
    .then(() => c.end())
    .then(() => console.log("schemas banking/bff ok"))
    .catch((e) => { console.error(e.message); process.exit(1); });
' )

# Serviços com migrations, na ordem de dependência.
# api primeiro (cria categorias que o seed usa); os demais são independentes.
MIGRATION_SERVICES=(
  "@finance/api"
  "@finance/banking-ms"
  "@finance/bff"
)

for svc in "${MIGRATION_SERVICES[@]}"; do
  echo ""
  echo "==> migrations: ${svc}"
  pnpm --filter "${svc}" migration:run
done

# Seeds.
echo ""
echo "==> seed: @finance/api"
pnpm --filter "@finance/api" seed

echo ""
echo "==> Concluído."
