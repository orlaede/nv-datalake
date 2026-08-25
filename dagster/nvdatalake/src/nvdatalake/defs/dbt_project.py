import os
from pathlib import Path

from dagster_dbt import DbtProject

# repo_root/dbt/nvdatalake
DBT_PROJECT_DIR = Path(__file__).parents[5] / "dbt" / "nvdatalake"
DBT_PROFILES_DIR = os.environ.get("DBT_PROFILES_DIR", os.path.expanduser("~/.dbt"))

dbt_project = DbtProject(project_dir=DBT_PROJECT_DIR, profiles_dir=DBT_PROFILES_DIR)
dbt_project.prepare_if_dev()
