from dagster import AssetSelection, DefaultScheduleStatus, ScheduleDefinition, define_asset_job

materialize_all_job = define_asset_job(
    name="materialize_all_job",
    selection=AssetSelection.all(),
)

materialize_all_schedule = ScheduleDefinition(
    job=materialize_all_job,
    cron_schedule="0 3 * * *",
    execution_timezone="America/Sao_Paulo",
    default_status=DefaultScheduleStatus.RUNNING,
)
