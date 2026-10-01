#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
COMPOSE=(docker compose --env-file /dev/null -p nv-kestra-e2e -f kestra/tests/docker-compose.yml)

cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then
    "${COMPOSE[@]}" logs --tail=60 kestra
  fi
  "${COMPOSE[@]}" down --volumes
  exit "$result"
}
trap cleanup EXIT

"${COMPOSE[@]}" up -d --build --wait --wait-timeout 300 kestra
"${COMPOSE[@]}" run --rm --no-deps kestra-import

# Only synthetic test credentials. Never source the project's .env here.
unset SOURCE_NVTR_DB_URL DATALAKE_DB_URL
export KESTRA_TEST_URL=http://localhost:18082
export KESTRA_API_USER=admin@kestra.local
export KESTRA_API_PASSWORD='Fixture123!'
export TEST_SOURCE_URL='postgresql+psycopg2://postgres:fixture@127.0.0.1:55440/nvtr'
export TEST_DATABASE_URL='postgresql+psycopg2://postgres:fixture@127.0.0.1:55440/nvdatalake'
export PYTHONPATH="$ROOT_DIR:$ROOT_DIR/dagster/nvdatalake/src"
export PGSSLMODE=disable
export DBT_PROFILES_DIR="$ROOT_DIR/dbt/nvdatalake"
export SOURCE_NVTR_DB_HOST=127.0.0.1 SOURCE_NVTR_DB_PORT=55440
export SOURCE_NVTR_DB_USER=postgres SOURCE_NVTR_DB_PASSWORD=fixture SOURCE_NVTR_DB_NAME=nvtr
export DATALAKE_DB_HOST=127.0.0.1 DATALAKE_DB_PORT=55440
export DATALAKE_DB_USER=postgres DATALAKE_DB_PASSWORD=fixture DATALAKE_DB_NAME=nvdatalake

uv run --project dagster/nvdatalake --frozen python -m pytest kestra/tests -v

# Restore a valid pipeline after tests intentionally inject failures; then verify
# Dagster's original tests against the same isolated databases.
uv run --project dagster/nvdatalake --frozen python scripts/kestra.py run --url "$KESTRA_TEST_URL"
uv run --project dagster/nvdatalake --frozen dbt parse --project-dir dbt/nvdatalake --profiles-dir dbt/nvdatalake
uv run --project dagster/nvdatalake --frozen python -m pytest dagster/nvdatalake/tests -v
