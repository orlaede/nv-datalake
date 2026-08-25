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
        """Env var prefix for this source: SOURCE_<DBNAME>_<SCHEMA>_"""
        return f"SOURCE_{self.dbname}_{self.schema}".upper()

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


# One entry per source database. Env vars derive automatically from
# dbname/schema as SOURCE_<DBNAME>_<SCHEMA>_DB_HOST/PORT/USER/PASSWORD/NAME
# (or a single SOURCE_<DBNAME>_<SCHEMA>_DB_URL). To add a new source: append
# a SourceConfig here, no other code changes needed.
SOURCES: list[SourceConfig] = [
    SourceConfig(
        dbname="nvtr",
        schema="ce_eusebio",
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
        schema="ce_aquiraz",
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
