"""Load every configured source into Bronze without importing Dagster definitions."""
import json
import os

from sqlalchemy import URL, create_engine
from sqlalchemy.engine import make_url

from nvdatalake.defs.bronze_loader import load_bronze_table
from nvdatalake.defs.sources_config import SOURCES


def database_url(prefix: str, default_dbname: str) -> URL:
    override = os.environ.get(f"{prefix}_DB_URL")
    if override:
        return make_url(override)
    return URL.create(
        "postgresql+psycopg2",
        username=os.environ.get(f"{prefix}_DB_USER", "postgres"),
        password=os.environ.get(f"{prefix}_DB_PASSWORD", "postgres"),
        host=os.environ.get(f"{prefix}_DB_HOST", "localhost"),
        port=int(os.environ.get(f"{prefix}_DB_PORT", "5432")),
        database=os.environ.get(f"{prefix}_DB_NAME", default_dbname),
    )


def main():
    connect_args = {"sslmode": os.environ.get("PGSSLMODE", "require")}
    destination = create_engine(database_url("DATALAKE", "nvdatalake"), connect_args=connect_args)
    counts = {}
    try:
        for source in SOURCES:
            engine = create_engine(database_url(source.env_prefix, source.dbname), connect_args=connect_args)
            try:
                for table_name in source.tables:
                    name = f"{source.key}__{table_name}"
                    counts[name] = load_bronze_table(source, table_name, engine, destination)
                    print(f"bronze.{name}: {counts[name]} rows", flush=True)
            finally:
                engine.dispose()
    finally:
        destination.dispose()
    with open("ingestion.json", "w") as report:
        json.dump(counts, report, indent=2)


if __name__ == "__main__":
    main()
