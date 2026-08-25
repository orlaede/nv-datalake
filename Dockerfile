FROM python:3.11-slim

RUN pip install --no-cache-dir uv

WORKDIR /app

# Install deps first (cache-friendly)
COPY dagster/nvdatalake/pyproject.toml dagster/nvdatalake/uv.lock dagster/nvdatalake/
RUN cd dagster/nvdatalake && uv sync --frozen

# App code (Dagster) + dbt project it wraps (path is relative: ../../dbt/nvdatalake)
COPY dagster/nvdatalake dagster/nvdatalake
COPY dbt/nvdatalake dbt/nvdatalake

ENV DAGSTER_HOME=/app/dagster_home
RUN mkdir -p "$DAGSTER_HOME"

ENV DBT_PROFILES_DIR=/app/dbt/nvdatalake

# Bake the dbt manifest at build time — prepare_if_dev() only regenerates it
# under `dagster dev`/`dg dev`, not under dagster-webserver in production.
RUN cd dagster/nvdatalake && uv run dbt parse --project-dir /app/dbt/nvdatalake

WORKDIR /app/dagster/nvdatalake
EXPOSE 3000

CMD ["uv", "run", "dagster-webserver", "-h", "0.0.0.0", "-p", "3000", "-m", "nvdatalake.definitions"]
