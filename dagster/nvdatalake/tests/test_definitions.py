from nvdatalake.definitions import defs
from nvdatalake.defs.sources_config import SOURCES


def test_defs_load():
    """Definitions must import and resolve without touching any database."""
    asset_graph = defs.resolve_asset_graph()
    assert asset_graph.get_all_asset_keys()


def test_bronze_assets_match_sources_config():
    asset_graph = defs.resolve_asset_graph()
    keys = {key.to_user_string() for key in asset_graph.get_all_asset_keys()}

    for source in SOURCES:
        for table_name in source.tables:
            assert f"bronze_{source.key}__{table_name}" in keys


def test_dbt_models_depend_on_bronze():
    asset_graph = defs.resolve_asset_graph()

    from dagster import AssetKey

    stg_key = AssetKey(["bronze", "stg_auto_infracao"])
    parents = {key.to_user_string() for key in asset_graph.get(stg_key).parent_keys}
    assert parents == {
        "bronze_nvtr_ce_eusebio__auto_infracao",
        "bronze_nvtr_ce_aquiraz__auto_infracao",
    }


def test_fact_depends_on_all_dimensions():
    from dagster import AssetKey

    asset_graph = defs.resolve_asset_graph()
    fac_key = AssetKey(["silver", "fac_auto_infracao"])
    parents = {key.to_user_string() for key in asset_graph.get(fac_key).parent_keys}

    expected_dims = {
        "silver/dim_agente",
        "silver/dim_infracao",
        "silver/dim_municipio",
        "silver/dim_pessoa",
        "silver/dim_veiculo",
        "silver/dim_erro_consistencia",
    }
    assert expected_dims.issubset(parents)
