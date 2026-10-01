import importlib
import os

import pytest
from sqlalchemy import create_engine, text


def test_loader_available_without_dagster_definitions():
    module = importlib.import_module("nvdatalake.defs.bronze_loader")
    assert callable(module.load_bronze_table)


def test_connection_preserves_special_password(monkeypatch):
    from kestra.ingest import database_url

    monkeypatch.setenv("DATALAKE_DB_PASSWORD", "p@ss:/?#%word")
    monkeypatch.delenv("DATALAKE_DB_URL", raising=False)
    url = database_url("DATALAKE", "nvdatalake")
    assert url.password == "p@ss:/?#%word"
    assert url.database == "nvdatalake"


def test_source_url_override(monkeypatch):
    from kestra.ingest import database_url

    monkeypatch.setenv("SOURCE_TEST_DB_URL", "postgresql://user:p%40ss@host:5433/test")
    url = database_url("SOURCE_TEST", "ignored")
    assert url.password == "p@ss"
    assert url.host == "host"
    assert url.port == 5433


def test_nullable_types_and_replacement():
    from nvdatalake.defs.bronze_loader import load_bronze_table
    from nvdatalake.defs.sources_config import SourceConfig

    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to an isolated PostgreSQL database")
    engine = create_engine(url)
    source = SourceConfig(dbname="fixture", schema="loader_test", tables=["sample"])
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS loader_test"))
            conn.execute(text("DROP TABLE IF EXISTS loader_test.sample"))
            conn.execute(text("CREATE TABLE loader_test.sample (id bigint, nullable_id bigint, flag boolean, amount numeric(10,2))"))
            conn.execute(text("INSERT INTO loader_test.sample VALUES (1, NULL, true, 12.34), (2, 7, false, NULL)"))
        assert load_bronze_table(source, "sample", engine, engine) == 2
        with engine.connect() as conn:
            assert conn.execute(text("SELECT data_type FROM information_schema.columns WHERE table_schema='bronze' AND table_name='fixture_loader_test__sample' AND column_name='nullable_id'")).scalar() == "bigint"
            assert conn.execute(text("SELECT nullable_id FROM bronze.fixture_loader_test__sample WHERE id=1")).scalar() is None
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM loader_test.sample WHERE id=2"))
        assert load_bronze_table(source, "sample", engine, engine) == 1
        with engine.connect() as conn:
            assert conn.execute(text("SELECT count(*) FROM bronze.fixture_loader_test__sample")).scalar() == 1
    finally:
        with engine.begin() as conn:
            conn.execute(text("DROP SCHEMA IF EXISTS loader_test CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS bronze.fixture_loader_test__sample"))
        engine.dispose()
