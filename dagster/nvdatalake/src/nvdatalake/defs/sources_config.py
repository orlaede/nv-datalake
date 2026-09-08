import os
from dataclasses import dataclass


@dataclass(frozen=True)
class SourceConfig:
    dbname: str  # source database name
    schema: str  # schema in the source db holding these tables
    tables: list[str]

    @property
    def key(self) -> str:
        """Identifies this source as <dbname>_<schema> — used as bronze table/resource prefix."""
        return f"{self.dbname}_{self.schema}"

    @property
    def env_prefix(self) -> str:
        """Env var prefix for this source's connection: SOURCE_<DBNAME>_

        Grouped by dbname (not dbname+schema) — two SourceConfigs pointing at
        different schemas of the same physical database share one set of
        connection env vars.
        """
        return f"SOURCE_{self.dbname}".upper()

    @property
    def db_url(self) -> str:
        return _db_url(self.env_prefix, self.dbname)


def _db_url(env_prefix: str, default_dbname: str) -> str:
    return os.environ.get(f"{env_prefix}_DB_URL") or (
        "postgresql+psycopg2://{user}:{password}@{host}:{port}/{dbname}".format(
            user=os.environ.get(f"{env_prefix}_DB_USER", "postgres"),
            password=os.environ.get(f"{env_prefix}_DB_PASSWORD", "postgres"),
            host=os.environ.get(f"{env_prefix}_DB_HOST", "localhost"),
            port=os.environ.get(f"{env_prefix}_DB_PORT", "5432"),
            dbname=os.environ.get(f"{env_prefix}_DB_NAME", default_dbname),
        )
    )


# One entry per (dbname, schema) pair. Env vars derive automatically from
# dbname as SOURCE_<DBNAME>_DB_HOST/PORT/USER/PASSWORD/NAME (or a single
# SOURCE_<DBNAME>_DB_URL) — sources sharing a dbname share connection env
# vars, even with different schemas. To add a new source: append a
# SourceConfig here, no other code changes needed.
SOURCES: list[SourceConfig] = [
    SourceConfig(
        dbname="nvtr",
        schema="ce_caucaia_amostra",
        tables=[
            "auto_infracao",
            "agente",
            "infracao",
            "municipio",
            "pessoa",
            "veiculo",
            "erro_consistencia",
        ],
    ),
    SourceConfig(
        dbname="nvtr",
        schema="ce_quixada",
        tables=[
            "auto_infracao",
            "agente",
            "infracao",
            "municipio",
            "pessoa",
            "veiculo",
            "erro_consistencia",
        ],
    ),
]
