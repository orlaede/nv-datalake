import pandas as pd
from sqlalchemy import MetaData, Table, text

from nvdatalake.defs.sources_config import SourceConfig


def load_bronze_table(source: SourceConfig, table_name: str, source_engine, datalake_db) -> int:
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
