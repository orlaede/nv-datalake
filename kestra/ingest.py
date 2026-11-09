"""Load every schema declared in the Kestra flow (`variables.schemas`) into Bronze."""
import json
import os
from dataclasses import dataclass, field

import pandas as pd
from sqlalchemy import URL, MetaData, Table, create_engine, inspect, text
from sqlalchemy.engine import make_url


@dataclass(frozen=True)
class Source:
    dbname: str  # source database name
    schema: str  # schema in the source db holding these tables
    tables: list[str]
    optional_tables: list[str] = field(default_factory=list)  # may be absent in the source schema

    @property
    def key(self) -> str:
        """Identifies this source as <dbname>_<schema> — used as bronze table prefix."""
        return f"{self.dbname}_{self.schema}"

    @property
    def env_prefix(self) -> str:
        """Env var prefix for this source's connection: SOURCE_<DBNAME>

        Grouped by dbname (not dbname+schema) — two sources pointing at
        different schemas of the same physical database share one set of
        connection env vars.
        """
        return f"SOURCE_{self.dbname}".upper()


def build_sources(dbname: str, schemas: list[str], tables: list[str], optional_tables: list[str] | None = None) -> list[Source]:
    """One Source per schema; every schema shares the same table lists."""
    return [Source(dbname, schema, list(tables), list(optional_tables or [])) for schema in schemas]


def sources_from_env() -> list[Source]:
    """Flow variables arrive as NVDATALAKE_DBNAME / _SCHEMAS / _TABLES / _OPTIONAL_TABLES (JSON lists)."""
    return build_sources(
        os.environ["NVDATALAKE_DBNAME"],
        json.loads(os.environ["NVDATALAKE_SCHEMAS"]),
        json.loads(os.environ["NVDATALAKE_TABLES"]),
        json.loads(os.environ.get("NVDATALAKE_OPTIONAL_TABLES", "[]")),
    )


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


def load_bronze_table(source: Source, table_name: str, source_engine, datalake_db) -> int:
    """Replace one Bronze table, preserving the source's PostgreSQL column types."""
    source_table = Table(table_name, MetaData(), schema=source.schema, autoload_with=source_engine)
    with source_engine.connect() as conn:
        df = pd.read_sql_query(source_table.select(), conn)
    dtype = {column.name: column.type for column in source_table.columns}

    with datalake_db.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS bronze"))
        df.to_sql(
            f"{source.key}__{table_name}",
            conn,
            schema="bronze",
            if_exists="replace",
            index=False,
            dtype=dtype,
        )
    return len(df)


def skip_missing_table(source: Source, table_name: str, datalake_db) -> str:
    """Log a missing optional table and drop any stale Bronze copy from a previous run."""
    name = f"{source.key}__{table_name}"
    with datalake_db.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS bronze"))
        conn.execute(text(f'DROP TABLE IF EXISTS bronze."{name}"'))
    print(f"WARNING: optional table {source.schema}.{table_name} not found in source; skipped (bronze.{name} not loaded)", flush=True)
    return name


def main():
    connect_args = {"sslmode": os.environ.get("PGSSLMODE", "require")}
    destination = create_engine(database_url("DATALAKE", "nvdatalake"), connect_args=connect_args)
    counts = {}
    skipped = []
    try:
        for source in sources_from_env():
            engine = create_engine(database_url(source.env_prefix, source.dbname), connect_args=connect_args)
            try:
                for table_name in source.tables:
                    name = f"{source.key}__{table_name}"
                    counts[name] = load_bronze_table(source, table_name, engine, destination)
                    print(f"bronze.{name}: {counts[name]} rows", flush=True)
                for table_name in source.optional_tables:
                    if not inspect(engine).has_table(table_name, schema=source.schema):
                        skipped.append(skip_missing_table(source, table_name, destination))
                        continue
                    name = f"{source.key}__{table_name}"
                    counts[name] = load_bronze_table(source, table_name, engine, destination)
                    print(f"bronze.{name}: {counts[name]} rows", flush=True)
            finally:
                engine.dispose()
    finally:
        destination.dispose()
    with open("ingestion.json", "w") as report:
        json.dump(counts, report, indent=2)
    with open("skipped.json", "w") as report:
        json.dump(skipped, report, indent=2)
    if skipped:
        print(f"WARNING: {len(skipped)} optional table(s) skipped: {', '.join(skipped)}", flush=True)


if __name__ == "__main__":
    main()
