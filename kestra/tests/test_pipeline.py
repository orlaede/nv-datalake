"""Run against the dedicated Compose stack, never the project's .env databases."""
from datetime import date, datetime
import json
import os
from pathlib import Path
import subprocess
from zoneinfo import ZoneInfo
from urllib.parse import quote

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError

import yaml

from kestra.ingest import build_sources
from scripts.kestra import Client


pytestmark = pytest.mark.skipif(not os.environ.get("KESTRA_TEST_URL"), reason="Run scripts/test_kestra.sh for real Kestra integration tests")
ROOT = Path(__file__).resolve().parents[2]
_VARIABLES = yaml.safe_load((ROOT / "kestra/flows/materialize_all.yml").read_text())["variables"]
SOURCES = build_sources(_VARIABLES["dbname"], _VARIABLES["schemas"], _VARIABLES["tables"], _VARIABLES["optional_tables"])
# fixtures.sql creates the optional tables (ait_retorno, codigo_retorno) only in these schemas.
WITH_AIT_RETORNO = {"nvtr_sc_pomerode", "nvtr_pr_curitiba"}
LOADED_TABLES = {config.key: config.tables + (config.optional_tables if config.key in WITH_AIT_RETORNO else []) for config in SOURCES}
DIMENSIONS = ["agente", "infracao", "municipio", "pessoa", "veiculo", "erro_consistencia", "origem", "auto"]


@pytest.fixture(scope="module")
def databases():
    engines = []
    for key, dbname in [("TEST_SOURCE_URL", "nvtr"), ("TEST_DATABASE_URL", "nvdatalake")]:
        url = make_url(os.environ[key])
        assert (url.host, url.port, url.database) == ("127.0.0.1", 55440, dbname), "Refusing to reset a database outside the isolated test stack"
        engines.append(create_engine(url))
    source, destination = engines
    with source.begin() as conn:
        for config in SOURCES:
            conn.execute(text(f"DROP SCHEMA IF EXISTS {config.schema} CASCADE"))
        conn.execute(text((ROOT / "kestra/tests/fixtures.sql").read_text()))
    with destination.begin() as conn:
        for schema in ["bronze", "silver", "gold", "config"]:
            conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
        # The config schema is owned by a manual migration, not by the pipeline.
        migration = text((ROOT / "db/migrations/003_config_parametros.sql").read_text())
        conn.execute(migration)
        conn.execute(migration)  # idempotent
        conn.execute(text("""INSERT INTO config.parametro (source_key, chave, valor) VALUES
            ('nvtr_sc_pomerode', 'tipo_envio_processamento', 'FTP'),
            ('nvtr_sc_pomerode', 'receptor_processamento', 'Receptor Pomerode'),
            ('nvtr_sc_pomerode', 'num_dias_retencao_processamento', '15'),
            ('nvtr_pr_curitiba', 'tipo_envio_processamento', 'API'),
            ('nvtr_pr_curitiba', 'receptor_processamento', 'Receptor Curitiba'),
            ('nvtr_pr_curitiba', 'num_dias_retencao_processamento', '0'),
            ('nvtr_sc_brusquet', 'data_inicial_autos', '2025-12-01'),
            ('*', 'num_dias_retencao_processamento', '7'),
            ('nvtr_inexistente', 'tipo_envio_processamento', 'X')"""))
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
    assert len(models) == 34
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
    assert set(report) == {f"{key}__{table}" for key, tables in LOADED_TABLES.items() for table in tables}
    with source.connect() as src, destination.connect() as dst:
        for config in SOURCES:
            for table in LOADED_TABLES[config.key]:
                expected = {"auto_infracao": 4 if config.key == "nvtr_sc_brusquet" else 3}.get(table, {"nvtr_sc_pomerode": 2, "nvtr_pr_curitiba": 3}[config.key] if table == "ait_retorno" else 1)
                assert report[f"{config.key}__{table}"] == expected
                assert dst.execute(text(f"SELECT count(*) FROM bronze.{config.key}__{table}")).scalar() == expected
                assert dst.execute(text(f"SELECT count(*) FROM bronze.stg_{table} WHERE source_key=:key"), {"key": config.key}).scalar() == expected
                columns = text("SELECT column_name, data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema=:schema AND table_name=:table ORDER BY ordinal_position")
                assert src.execute(columns, {"schema": config.schema, "table": table}).all() == dst.execute(columns, {"schema": "bronze", "table": f"{config.key}__{table}"}).all()
        assert dst.execute(text("SELECT situacao_habilitacao FROM bronze.stg_pessoa WHERE source_key='nvtr_pr_curitiba'")).scalar() is None
        assert dst.execute(text("SELECT motivo_cancelamento FROM bronze.stg_auto_infracao WHERE source_key='nvtr_sc_bcamboriu' AND id=1")).scalar() is None
        assert dst.execute(text("SELECT motivo_cancelamento FROM bronze.stg_auto_infracao WHERE source_key='nvtr_ce_caucaia_amostra' AND id=1")).scalar() == "JUSTIFICADO"
        # Columns that exist in only some schemas are kept, null for the others.
        for table, column in [("auto_infracao", "cod_pre_auto"), ("auto_infracao", "arquivo_ftp_retorno_id"), ("infracao", "valor"), ("infracao", "orgao_interposicao"), ("veiculo", "exercicio")]:
            assert dst.execute(text(f"SELECT count(*) FROM information_schema.columns WHERE table_schema='bronze' AND table_name='stg_{table}' AND column_name='{column}'")).scalar() == 1
            assert dst.execute(text(f"SELECT count(*) FROM bronze.stg_{table} WHERE {column} IS NOT NULL")).scalar() == 0


def test_optional_tables_missing_are_skipped_not_failed(execution, databases, client):
    _, destination = databases
    skipped = read_artifact(client, execution, "ingest_bronze", "skipped.json")
    absent = [config.key for config in SOURCES if config.key not in WITH_AIT_RETORNO]
    assert sorted(skipped) == sorted(f"{key}__{table}" for key in absent for table in _VARIABLES["optional_tables"])
    with destination.connect() as dst:
        for table in _VARIABLES["optional_tables"]:
            assert dst.execute(text(f"SELECT count(*) FROM bronze.stg_{table}")).scalar() == (5 if table == "ait_retorno" else 2)
            for key in absent:
                assert dst.execute(text("SELECT count(*) FROM information_schema.tables WHERE table_schema='bronze' AND table_name=:t"), {"t": f"{key}__{table}"}).scalar() == 0


def test_codigo_retorno_dimension_and_ait_retorno_fact(execution, databases):
    _, destination = databases
    with destination.connect() as conn:
        assert conn.execute(text("SELECT source_key, id, codigo_retorno, descricao, retorno_sucesso FROM silver.dim_codigo_retorno WHERE sk_codigo_retorno > 0 ORDER BY source_key")).all() == [
            ("nvtr_pr_curitiba", 1, 200, "Rejeitado", False),
            ("nvtr_sc_pomerode", 1, 100, "Aceito", True),
        ]
        assert conn.execute(text("SELECT count(*) FROM silver.dim_codigo_retorno WHERE sk_codigo_retorno = 0")).scalar() == 1
        rows = conn.execute(text("SELECT f.source_key, f.id, f.num_auto, c.descricao, o.nome FROM silver.fac_ait_retorno f JOIN silver.dim_codigo_retorno c USING (sk_codigo_retorno) JOIN silver.dim_origem o USING (sk_origem) ORDER BY f.source_key, f.id")).all()
        assert rows == [
            ("nvtr_pr_curitiba", 1, "Curitiba1", "Rejeitado", "Curitiba"),
            ("nvtr_pr_curitiba", 2, "Curitiba2", "Rejeitado", "Curitiba"),
            ("nvtr_pr_curitiba", 4, "Curitiba1", "Rejeitado", "Curitiba"),
            ("nvtr_sc_pomerode", 1, "Pomerode1", "Aceito", "Pomerode"),
            ("nvtr_sc_pomerode", 2, "Pomerode2", "Não Informado", "Pomerode"),
        ]
        # sk_auto links both facts through dim_auto (business key source_key + trimmed num_auto).
        linked = conn.execute(text("SELECT r.source_key, r.id, a.id FROM silver.fac_ait_retorno r JOIN silver.fac_auto_infracao a USING (sk_auto) WHERE r.sk_auto > 0 ORDER BY r.source_key, r.id")).all()
        assert linked == [("nvtr_pr_curitiba", 1, 1), ("nvtr_pr_curitiba", 2, 2), ("nvtr_pr_curitiba", 4, 1), ("nvtr_sc_pomerode", 1, 1), ("nvtr_sc_pomerode", 2, 2)]
        assert conn.execute(text("SELECT source_key, id FROM silver.fac_ait_retorno WHERE sk_auto = 0")).all() == []
        assert conn.execute(text("SELECT count(*) FROM silver.fac_auto_infracao WHERE sk_auto = 0")).scalar() == 0
        # num_dias = days from the auto's data_hora to the dbt run date (America/Sao_Paulo); orphan return has none.
        today = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
        days = {i: (today - d).days for i, d in {1: date(2026, 1, 10), 2: date(2026, 1, 20), 3: date(2026, 2, 5)}.items()}
        for layer in ("silver", "gold"):
            assert conn.execute(text(f"SELECT id, num_dias FROM {layer}.fac_auto_infracao WHERE source_key='nvtr_pr_curitiba' ORDER BY id")).all() == list(days.items())
            assert conn.execute(text(f"SELECT id, num_dias FROM {layer}.fac_ait_retorno WHERE source_key='nvtr_pr_curitiba' ORDER BY id")).all() == [(1, days[1]), (2, days[2]), (4, days[1])]
        for name in ["dim_codigo_retorno", "fac_ait_retorno"]:
            sql = f"(SELECT * FROM silver.{name} EXCEPT ALL SELECT * FROM gold.{name}) UNION ALL (SELECT * FROM gold.{name} EXCEPT ALL SELECT * FROM silver.{name})"
            assert conn.execute(text(sql)).all() == []
            assert conn.execute(text(f"SELECT count(*) FROM gold.{name}")).scalar() > 0


def test_dimensions_and_fact_resolution(execution, databases):
    _, destination = databases
    with destination.connect() as conn:
        for dim in DIMENSIONS:
            expected = {"municipio": 2, "origem": len(SOURCES), "auto": 3 * len(SOURCES) + 2}.get(dim, len(SOURCES) + 1)
            assert conn.execute(text(f"SELECT count(*) FROM silver.dim_{dim}")).scalar() == expected
            if dim != "origem":
                assert conn.execute(text(f"SELECT count(*) FROM silver.dim_{dim} WHERE sk_{dim}=0")).scalar() == 1
        assert conn.execute(text("SELECT descricao, version FROM silver.dim_municipio WHERE codigo=2304400")).one() == ("Fortaleza", 0)
        rows = conn.execute(text("SELECT f.source_key, a.nome, p.nome, v.placa FROM silver.fac_auto_infracao f JOIN silver.dim_agente a USING (sk_agente) JOIN silver.dim_pessoa p ON f.sk_condutor=p.sk_pessoa JOIN silver.dim_veiculo v USING (sk_veiculo) WHERE f.id=1 ORDER BY f.source_key")).all()
        assert rows == [
            ("nvtr_ce_caucaia_amostra", "Agente Caucaia", "Ana", "AAA0001"),
            ("nvtr_pr_curitiba", "Agente Curitiba", "Pessoa Curitiba", "CUR0001"),
            ("nvtr_sc_bcamboriu", "Agente Bcamboriu", "Pessoa Bcamboriu", "BCA0001"),
            ("nvtr_sc_brusquet", "Agente Brusquet", "Pessoa Brusquet", "BRU0001"),
            ("nvtr_sc_criciumat", "Agente Criciumat", "Pessoa Criciumat", "CRI0001"),
            ("nvtr_sc_pomerode", "Agente Pomerode", "Pessoa Pomerode", "POM0001"),
        ]
        keys = "sk_agente, sk_condutor, sk_infracao, sk_infrator, sk_municipio, sk_veiculo, sk_erro_consistencia"
        assert conn.execute(text(f"SELECT {keys} FROM silver.fac_auto_infracao WHERE id=3")).all() == [(0,) * 7] * len(SOURCES)
        assert conn.execute(text("SELECT source_key, nome FROM silver.dim_origem ORDER BY source_key")).all() == [
            ("nvtr_ce_caucaia_amostra", "Caucaia (Amostra)"),
            ("nvtr_pr_curitiba", "Curitiba"),
            ("nvtr_sc_bcamboriu", "Balneário Camboriú"),
            ("nvtr_sc_brusquet", "Brusque"),
            ("nvtr_sc_criciumat", "Criciúma"),
            ("nvtr_sc_pomerode", "Pomerode"),
        ]


def test_data_inicial_filters_autos_and_their_returns(execution, databases):
    _, destination = databases
    with destination.connect() as conn:
        old = dict(conn.execute(text("SELECT source_key, count(*) FROM bronze.stg_auto_infracao WHERE data_hora < '2026-01-01' GROUP BY 1")).all())
        assert old == {"nvtr_sc_brusquet": 1}  # only the origin whose config.parametro_origem moves the start date back
        assert conn.execute(text("SELECT num_auto FROM bronze.stg_ait_retorno WHERE num_auto IN ('ORFAO', 'Curitiba4')")).all() == []
        assert conn.execute(text("SELECT data_inicial_autos FROM silver.dim_parametro_origem WHERE source_key='nvtr_sc_brusquet'")).scalar().isoformat() == "2025-12-01"


def test_parametro_origem_dimension(execution, databases):
    _, destination = databases
    with destination.connect() as conn:
        for layer in ("silver", "gold"):
            rows = conn.execute(text(f"SELECT source_key, tipo_envio_processamento, receptor_processamento, num_dias_retencao_processamento, data_inicial_autos FROM {layer}.dim_parametro_origem ORDER BY source_key")).all()
            assert len(rows) == len(SOURCES)  # one per origin; orphan config row is ignored
            by_key = {row[0]: row[1:] for row in rows}
            padrao, brusquet = date(2026, 1, 1), date(2025, 12, 1)
            assert by_key["nvtr_sc_pomerode"] == ("FTP", "Receptor Pomerode", 15, padrao)
            assert by_key["nvtr_pr_curitiba"] == ("API", "Receptor Curitiba", 0, padrao)
            assert by_key["nvtr_sc_bcamboriu"] == (None, None, 7, padrao)  # no own values: '*' fallback
            assert by_key["nvtr_sc_brusquet"] == (None, None, 7, brusquet)  # own data_inicial_autos wins
            assert "nvtr_inexistente" not in by_key
        # Parameters compare with num_dias: autos still inside the retention window.
        assert conn.execute(text("SELECT count(*) FROM silver.fac_auto_infracao f JOIN silver.dim_parametro_origem p USING (sk_origem) WHERE f.num_dias <= p.num_dias_retencao_processamento")).scalar() == 0
    invalid = [
        "('nvtr_sc_pomerode', 'chave_inexistente', 'x')",
        "('nvtr_sc_pomerode', 'data_inicial_autos', '01/01/2026')",
        "('nvtr_sc_pomerode', 'num_dias_retencao_processamento', '-1')",
        "('nvtr_sc_pomerode', 'data_inicial_padrao', '2026-01-01')",  # global key only for '*'
    ]
    for values in invalid:
        with pytest.raises(DBAPIError), destination.begin() as conn:
            conn.execute(text(f"INSERT INTO config.parametro (source_key, chave, valor) VALUES {values}"))


def test_gold_mirrors_and_monthly_totals(execution, databases):
    _, destination = databases
    with destination.connect() as conn:
        for name in [f"dim_{dim}" for dim in DIMENSIONS] + ["fac_auto_infracao"]:
            sql = f"(SELECT * FROM silver.{name} EXCEPT ALL SELECT * FROM gold.{name}) UNION ALL (SELECT * FROM gold.{name} EXCEPT ALL SELECT * FROM silver.{name})"
            assert conn.execute(text(sql)).all() == []
        rows = conn.execute(text("SELECT to_char(mes, 'YYYY-MM'), sk_origem, total_autos FROM gold.fac_auto_infracao_mensal ORDER BY mes, sk_origem")).all()
        origens = range(1, len(SOURCES) + 1)
        assert rows == [("2025-12", 4, 1)] + [("2026-01", sk, 2) for sk in origens] + [("2026-02", sk, 1) for sk in origens]


def test_repeat_execution_is_idempotent(execution, client, databases):
    second = client.wait(client.execute()["id"], timeout=300)
    assert second["state"]["current"] == "SUCCESS"
    _, destination = databases
    with destination.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM gold.fac_auto_infracao")).scalar() == 3 * len(SOURCES) + 1
        assert conn.execute(text("SELECT sum(total_autos) FROM gold.fac_auto_infracao_mensal")).scalar() == 3 * len(SOURCES) + 1


def test_history_and_artifacts_survive_restart(execution, client):
    compose = ["docker", "compose", "--env-file", "/dev/null", "-p", "nv-kestra-e2e", "-f", str(ROOT / "kestra/tests/docker-compose.yml")]
    subprocess.run([*compose, "restart", "kestra"], check=True, timeout=90)
    subprocess.run([*compose, "up", "-d", "--wait", "--wait-timeout", "90", "kestra"], check=True, timeout=100)
    restored = client.request("GET", f"/executions/{execution['id']}")
    assert restored["state"]["current"] == "SUCCESS"
    assert read_artifact(client, restored, "build_dbt", "manifest.json") == read_artifact(client, execution, "build_dbt", "manifest.json")
    assert len(read_artifact(client, restored, "ingest_bronze", "ingestion.json")) == sum(len(tables) for tables in LOADED_TABLES.values())


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
        conn.execute(text("INSERT INTO ce_caucaia_amostra.auto_infracao (id, num_auto, data_hora) VALUES (1, 'DUPLICATE', '2026-03-01')"))
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
