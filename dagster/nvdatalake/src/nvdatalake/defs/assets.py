import pandas as pd
from dagster import AssetExecutionContext, asset
from sqlalchemy import MetaData, Table, text

from nvdatalake.defs.sources_config import SOURCES, SourceConfig


def _make_bronze_asset(source: SourceConfig, table_name: str):
    bronze_table_name = f"{source.key}__{table_name}"
    source_resource_key = f"source_db_{source.key}"

    @asset(
        name=f"bronze_{bronze_table_name}",
        required_resource_keys={source_resource_key, "datalake_db"},
    )
    def _bronze_asset(context: AssetExecutionContext) -> None:
        """Extracts {source.schema}.{table} from the {source.dbname} db and lands it in nvdatalake.bronze."""

        source_engine = getattr(context.resources, source_resource_key)
        datalake_db = context.resources.datalake_db

        query = f"SELECT * FROM {source.schema}.{table_name}"
        with source_engine.connect() as conn:
            df = pd.read_sql_query(query, conn)

        # Reflect the source table's real column types so nullable integer
        # columns don't get silently coerced to float/text by pandas.to_sql.
        source_table = Table(table_name, MetaData(), schema=source.schema, autoload_with=source_engine)
        dtype = {column.name: column.type for column in source_table.columns}

        with datalake_db.connect() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS bronze"))
            conn.commit()
            df.to_sql(
                bronze_table_name,
                conn,
                schema="bronze",
                if_exists="replace",
                index=False,
                dtype=dtype,
            )
            conn.commit()

    return _bronze_asset


bronze_assets = [
    _make_bronze_asset(source, table_name) for source in SOURCES for table_name in source.tables
]
