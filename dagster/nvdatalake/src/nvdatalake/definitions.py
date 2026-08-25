import os

from dagster import Definitions
from dagster_dbt import DbtCliResource
from sqlalchemy import create_engine

from nvdatalake.defs.assets import bronze_assets
from nvdatalake.defs.dbt_assets import nvdatalake_dbt_assets
from nvdatalake.defs.dbt_project import DBT_PROFILES_DIR, dbt_project
from nvdatalake.defs.schedules import materialize_all_schedule
from nvdatalake.defs.sources_config import SOURCES

# Destination: data lake db (nvdatalake), schema bronze — same connection dbt uses,
# built from the same pieces as dbt/nvdatalake/profiles.yml so they never drift apart.
DATALAKE_DB_URL = "postgresql+psycopg2://{user}:{password}@{host}:{port}/{dbname}".format(
    user=os.environ.get("DATALAKE_DB_USER", "postgres"),
    password=os.environ.get("DATALAKE_DB_PASSWORD", "postgres"),
    host=os.environ.get("DATALAKE_DB_HOST", "localhost"),
    port=os.environ.get("DATALAKE_DB_PORT", "5432"),
    dbname=os.environ.get("DATALAKE_DB_NAME", "nvdatalake"),
)

datalake_db_engine = create_engine(DATALAKE_DB_URL)

# One SQLAlchemy engine per configured source db, registered as source_db_<dbname>_<schema>
source_db_resources = {
    f"source_db_{source.key}": create_engine(source.db_url) for source in SOURCES
}

defs = Definitions(
    assets=[*bronze_assets, nvdatalake_dbt_assets],
    schedules=[materialize_all_schedule],
    resources={
        "datalake_db": datalake_db_engine,
        "dbt": DbtCliResource(project_dir=dbt_project, profiles_dir=DBT_PROFILES_DIR),
        **source_db_resources,
    },
)
