#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
DAGSTER_DIR="$ROOT_DIR/dagster/nvdatalake"
ENV_FILE="$ROOT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# Source db "nvtr" (shared across all its schemas: ce_eusebio, ce_aquiraz, ...)
export SOURCE_NVTR_DB_HOST="${SOURCE_NVTR_DB_HOST:-localhost}"
export SOURCE_NVTR_DB_PORT="${SOURCE_NVTR_DB_PORT:-5432}"
export SOURCE_NVTR_DB_USER="${SOURCE_NVTR_DB_USER:-postgres}"
export SOURCE_NVTR_DB_PASSWORD="${SOURCE_NVTR_DB_PASSWORD:-postgres}"
export SOURCE_NVTR_DB_NAME="${SOURCE_NVTR_DB_NAME:-nvtr}"

# Destination db (nvdatalake)
export DATALAKE_DB_HOST="${DATALAKE_DB_HOST:-localhost}"
export DATALAKE_DB_PORT="${DATALAKE_DB_PORT:-5432}"
export DATALAKE_DB_USER="${DATALAKE_DB_USER:-postgres}"
export DATALAKE_DB_PASSWORD="${DATALAKE_DB_PASSWORD:-postgres}"
export DATALAKE_DB_NAME="${DATALAKE_DB_NAME:-nvdatalake}"

# Points dbt at the project-local profiles.yml (env_var-driven) instead of
# falling back to ~/.dbt/profiles.yml, which has hardcoded local defaults.
export DBT_PROFILES_DIR="${DBT_PROFILES_DIR:-$ROOT_DIR/dbt/nvdatalake}"

cd "$DAGSTER_DIR"
uv run dagster asset materialize --select '*' -m nvdatalake.definitions
