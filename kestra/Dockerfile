FROM ghcr.io/astral-sh/uv:0.8.24 AS uv
FROM kestra/kestra:v1.3.41

USER root
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_PYTHON_INSTALL_DIR=/opt/python
RUN uv python install 3.11

WORKDIR /opt/nvdatalake
COPY dagster/nvdatalake/pyproject.toml dagster/nvdatalake/uv.lock dagster/nvdatalake/
RUN uv sync --project dagster/nvdatalake --frozen --no-dev --no-install-project --python 3.11
COPY dagster/nvdatalake/src dagster/nvdatalake/src
COPY dbt/nvdatalake dbt/nvdatalake
COPY kestra/ingest.py kestra/ingest.py
COPY scripts/kestra.py scripts/kestra.py
COPY kestra/flows /opt/kestra/flows

ENV PATH="/opt/nvdatalake/dagster/nvdatalake/.venv/bin:${PATH}"
ENV PYTHONPATH=/opt/nvdatalake/dagster/nvdatalake/src
RUN dbt parse --project-dir dbt/nvdatalake --profiles-dir dbt/nvdatalake \
    && rm -rf dbt/nvdatalake/target dbt/nvdatalake/logs \
    && mkdir -p /app/storage /tmp/kestra-wd \
    && chown -R kestra:kestra /opt/nvdatalake /app/storage /tmp/kestra-wd
USER kestra
WORKDIR /app
