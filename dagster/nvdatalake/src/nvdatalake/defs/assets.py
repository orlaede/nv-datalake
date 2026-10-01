from dagster import AssetExecutionContext, asset

from nvdatalake.defs.bronze_loader import load_bronze_table
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

        load_bronze_table(source, table_name, source_engine, datalake_db)

    return _bronze_asset


bronze_assets = [
    _make_bronze_asset(source, table_name) for source in SOURCES for table_name in source.tables
]
