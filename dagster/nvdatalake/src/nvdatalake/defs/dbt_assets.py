from dagster import AssetExecutionContext, AssetKey
from dagster_dbt import DagsterDbtTranslator, DbtCliResource, dbt_assets

from nvdatalake.defs.dbt_project import dbt_project


class BronzeSourceTranslator(DagsterDbtTranslator):
    """Maps dbt sources (schema `bronze`) onto the matching bronze_<table> Dagster asset."""

    def get_asset_key(self, dbt_resource_props):
        if dbt_resource_props["resource_type"] == "source":
            return AssetKey(f"bronze_{dbt_resource_props['name']}")
        return super().get_asset_key(dbt_resource_props)


@dbt_assets(manifest=dbt_project.manifest_path, dagster_dbt_translator=BronzeSourceTranslator())
def nvdatalake_dbt_assets(context: AssetExecutionContext, dbt: DbtCliResource):
    yield from dbt.cli(["build"], context=context).stream()
