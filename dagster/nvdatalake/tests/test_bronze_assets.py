import pytest
from dagster import materialize
from sqlalchemy import text

from nvdatalake.definitions import datalake_db_engine, source_db_resources
from nvdatalake.defs.assets import bronze_assets

ASSET_NAME = "bronze_nvtr_ce_caucaia_amostra__erro_consistencia"


def _find_asset(name):
    for asset_def in bronze_assets:
        if name in {key.to_user_string() for key in asset_def.keys}:
            return asset_def
    raise LookupError(name)


@pytest.fixture(scope="module")
def db_available():
    try:
        with datalake_db_engine.connect():
            pass
    except Exception as exc:
        pytest.skip(f"nvdatalake db not reachable: {exc}")


def test_materialize_bronze_erro_consistencia(db_available):
    """Extracts nvtr.ce_caucaia_amostra.erro_consistencia and lands it in nvdatalake.bronze."""

    asset_def = _find_asset(ASSET_NAME)

    result = materialize(
        [asset_def],
        resources={"datalake_db": datalake_db_engine, **source_db_resources},
    )

    assert result.success

    with datalake_db_engine.connect() as conn:
        count = conn.execute(
            text("select count(*) from bronze.nvtr_ce_caucaia_amostra__erro_consistencia")
        ).scalar()
    assert count > 0
