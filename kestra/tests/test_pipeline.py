"""Run against the dedicated Compose stack, never the project's .env databases."""
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import quote

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from nvdatalake.defs.sources_config import SOURCES
from scripts.kestra import Client


pytestmark = pytest.mark.skipif(not os.environ.get("KESTRA_TEST_URL"), reason="Run scripts/test_kestra.sh for real Kestra integration tests")
ROOT = Path(__file__).resolve().parents[2]
DIMENSIONS = ["agente", "infracao", "municipio", "pessoa", "veiculo", "erro_consistencia", "origem"]


@pytest.fixture(scope="module")
def databases():
    engines = []
    for key, dbname in [("TEST_SOURCE_URL", "nvtr"), ("TEST_DATABASE_URL", "nvdatalake")]:
        url = make_url(os.environ[key])
        assert (url.host, url.port, url.database) == ("127.0.0.1", 55440, dbname), "Refusing to reset a database outside the isolated test stack"
        engines.append(create_engine(url))
    source, destination = engines
    with source.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS ce_caucaia_amostra CASCADE"))
        conn.execute(text("DROP SCHEMA IF EXISTS ce_quixada CASCADE"))
        conn.execute(text((ROOT / "kestra/tests/fixtures.sql").read_text()))
    with destination.begin() as conn:
        for schema in ["bronze", "silver", "gold"]:
            conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
    yield source, destination
    for engine in engines:
        engine.dispose()


@pytest.fixture(scope="module")
def client():
    client = Client(os.environ["KESTRA_TEST_URL"])
    source = (ROOT / "kestra/flows/materialize_all.yml").read_bytes()
    validation = client.validate(source)
    assert not any(flow.get("constraints") or flow.get("violations") for flow in validation)
    client.import_flow(source)
    return client


@pytest.fixture(scope="module")
def execution(databases, client):
    result = client.wait(client.execute(full_refresh=True)["id"], timeout=300)
    assert result["state"]["current"] == "SUCCESS"
    return result


def read_artifact(client, execution, task, name):
    files = next(run["outputs"]["outputFiles"] for run in execution["taskRunList"] if run["taskId"] == task)
    path = next(value for key, value in files.items() if key.endswith(name))
    body = client.request("GET", f"/executions/{execution['id']}/file?path={quote(path, safe='')}", raw=True)
    return json.loads(body)


def test_all_models_tests_profiles_and_artifacts(execution, client):
    manifest = read_artifact(client, execution, "build_dbt", "manifest.json")
    results = read_artifact(client, execution, "build_dbt", "run_results.json")
    catalog = read_artifact(client, execution, "docs_dbt", "catalog.json")
    models = {key: node for key, node in manifest["nodes"].items() if node["resource_type"] == "model"}
    assert len(models) == 24
    assert len(manifest["sources"]) == 14
    assert set(models) == {row["unique_id"] for row in results["results"] if row["unique_id"].startswith("model.")}
    tests = {key for key, node in manifest["nodes"].items() if node["resource_type"] == "test"}
    assert tests == {row["unique_id"] for row in results["results"] if row["unique_id"].startswith("test.")}
    assert all(row["status"] in {"success", "pass"} for row in results["results"])
    assert set(catalog["nodes"]) == set(models)
    for model_id, model in models.items():
        assert model["schema"] in {"bronze", "silver", "gold"}
        assert model["config"]["materialized"] == "table"
        assert any(node["resource_type"] == "test" and model_id in node["depends_on"]["nodes"] for node in manifest["nodes"].values()), model_id
    flow = client.request("GET", "/flows/nvdatalake/materialize_all")
    assert flow["triggers"][0]["disabled"] is True
    assert flow["triggers"][0]["timezone"] == "America/Sao_Paulo"
    assert flow["concurrency"]["limit"] == 1


def test_all_bronze_sources_types_and_staging(execution, databases, client):
    source, destination = databases
    report = read_artifact(client, execution, "ingest_bronze", "ingestion.json")
    assert set(report) == {f"{config.key}__{table}" for config in SOURCES for table in config.tables}
    with source.connect() as src, destination.connect() as dst:
        for config in SOURCES:
            for table in config.tables:
                expected = 3 if table == "auto_infracao" else 1
                assert report[f"{config.key}__{table}"] == expected
                assert dst.execute(text(f"SELECT count(*) FROM bronze.{config.key}__{table}")).scalar() == expected
                assert dst.execute(text(f"SELECT count(*) FROM bronze.stg_{table} WHERE source_key=:key"), {"key": config.key}).scalar() == expected
                columns = text("SELECT column_name, data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema=:schema AND table_name=:table ORDER BY ordinal_position")
                assert src.execute(columns, {"schema": config.schema, "table": table}).all() == dst.execute(columns, {"schema": "bronze", "table": f"{config.key}__{table}"}).all()
        assert dst.execute(text("SELECT situacao_habilitacao FROM bronze.stg_pessoa WHERE source_key='nvtr_ce_quixada'")).scalar() is None
        assert dst.execute(text("SELECT motivo_cancelamento FROM bronze.stg_auto_infracao WHERE source_key='nvtr_ce_quixada' AND id=1")).scalar() is None
        assert dst.execute(text("SELECT motivo_cancelamento FROM bronze.stg_auto_infracao WHERE source_key='nvtr_ce_caucaia_amostra' AND id=1")).scalar() == "JUSTIFICADO"


def test_dimensions_and_fact_resolution(execution, databases):
    _, destination = databases
    with destination.connect() as conn:
        for dim in DIMENSIONS:
            expected = 2 if dim in {"municipio", "origem"} else 3
            assert conn.execute(text(f"SELECT count(*) FROM silver.dim_{dim}")).scalar() == expected
            if dim != "origem":
                assert conn.execute(text(f"SELECT count(*) FROM silver.dim_{dim} WHERE sk_{dim}=0")).scalar() == 1
        assert conn.execute(text("SELECT descricao, version FROM silver.dim_municipio WHERE codigo=2304400")).one() == ("Fortaleza", 0)
        rows = conn.execute(text("SELECT f.source_key, a.nome, p.nome, v.placa FROM silver.fac_auto_infracao f JOIN silver.dim_agente a USING (sk_agente) JOIN silver.dim_pessoa p ON f.sk_condutor=p.sk_pessoa JOIN silver.dim_veiculo v USING (sk_veiculo) WHERE f.id=1 ORDER BY f.source_key")).all()
        assert rows == [("nvtr_ce_caucaia_amostra", "Agente Caucaia", "Ana", "AAA0001"), ("nvtr_ce_quixada", "Agente Quixada", "Beto", "BBB0002")]
        keys = "sk_agente, sk_condutor, sk_infracao, sk_infrator, sk_municipio, sk_veiculo, sk_erro_consistencia"
        assert conn.execute(text(f"SELECT {keys} FROM silver.fac_auto_infracao WHERE id=3")).all() == [(0,) * 7, (0,) * 7]
        assert conn.execute(text("SELECT source_key, nome FROM silver.dim_origem ORDER BY source_key")).all() == [("nvtr_ce_caucaia_amostra", "Caucaia (Amostra)"), ("nvtr_ce_quixada", "Quixadá")]


def test_gold_mirrors_and_monthly_totals(execution, databases):
    _, destination = databases
    with destination.connect() as conn:
        for name in [f"dim_{dim}" for dim in DIMENSIONS] + ["fac_auto_infracao"]:
            sql = f"(SELECT * FROM silver.{name} EXCEPT ALL SELECT * FROM gold.{name}) UNION ALL (SELECT * FROM gold.{name} EXCEPT ALL SELECT * FROM silver.{name})"
            assert conn.execute(text(sql)).all() == []
        rows = conn.execute(text("SELECT to_char(mes, 'YYYY-MM'), sk_origem, total_autos FROM gold.fac_auto_infracao_mensal ORDER BY mes, sk_origem")).all()
        assert rows == [("2026-01", 1, 2), ("2026-01", 2, 2), ("2026-02", 1, 1), ("2026-02", 2, 1)]


def test_repeat_execution_is_idempotent(execution, client, databases):
    second = client.wait(client.execute()["id"], timeout=300)
    assert second["state"]["current"] == "SUCCESS"
    _, destination = databases
    with destination.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM gold.fac_auto_infracao")).scalar() == 6
        assert conn.execute(text("SELECT sum(total_autos) FROM gold.fac_auto_infracao_mensal")).scalar() == 6


def test_history_and_artifacts_survive_restart(execution, client):
    compose = ["docker", "compose", "--env-file", "/dev/null", "-p", "nv-kestra-e2e", "-f", str(ROOT / "kestra/tests/docker-compose.yml")]
    subprocess.run([*compose, "restart", "kestra"], check=True, timeout=90)
    subprocess.run([*compose, "up", "-d", "--wait", "--wait-timeout", "90", "kestra"], check=True, timeout=100)
    restored = client.request("GET", f"/executions/{execution['id']}")
    assert restored["state"]["current"] == "SUCCESS"
    assert read_artifact(client, restored, "build_dbt", "manifest.json") == read_artifact(client, execution, "build_dbt", "manifest.json")
    assert len(read_artifact(client, restored, "ingest_bronze", "ingestion.json")) == 14


def test_ingestion_failure_prevents_dbt(execution, client, databases):
    source, _ = databases
    with source.begin() as conn:
        conn.execute(text("ALTER TABLE ce_caucaia_amostra.agente RENAME TO agente_missing"))
    try:
        execution_id = client.execute()["id"]
        with pytest.raises(RuntimeError, match="FAILED"):
            client.wait(execution_id, timeout=60)
        result = client.request("GET", f"/executions/{execution_id}")
        assert not any(task["taskId"] == "build_dbt" for task in result["taskRunList"])
    finally:
        with source.begin() as conn:
            conn.execute(text("ALTER TABLE ce_caucaia_amostra.agente_missing RENAME TO agente"))


def test_dbt_quality_failure_fails_flow(execution, client, databases):
    source, _ = databases
    with source.begin() as conn:
        conn.execute(text("INSERT INTO ce_caucaia_amostra.auto_infracao (id, num_auto) VALUES (1, 'DUPLICATE')"))
    try:
        execution_id = client.execute()["id"]
        with pytest.raises(RuntimeError, match="FAILED"):
            client.wait(execution_id, timeout=180)
        result = client.request("GET", f"/executions/{execution_id}")
        assert any(task["taskId"] == "build_dbt" and task["state"]["current"] == "FAILED" for task in result["taskRunList"])
        assert not any(task["taskId"] == "docs_dbt" for task in result["taskRunList"])
    finally:
        with source.begin() as conn:
            conn.execute(text("DELETE FROM ce_caucaia_amostra.auto_infracao WHERE num_auto='DUPLICATE'"))
