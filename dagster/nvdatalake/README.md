# nvdatalake

## Getting started

### Installing dependencies

**Option 1: uv**

Ensure [`uv`](https://docs.astral.sh/uv/) is installed following their [official documentation](https://docs.astral.sh/uv/getting-started/installation/).

Create a virtual environment, and install the required dependencies using _sync_:

```bash
uv sync
```

Then, activate the virtual environment:

| OS | Command |
| --- | --- |
| MacOS | ```source .venv/bin/activate``` |
| Windows | ```.venv\Scripts\activate``` |

**Option 2: pip**

Install the python dependencies with [pip](https://pypi.org/project/pip/):

```bash
python3 -m venv .venv
```

Then activate the virtual environment:

| OS | Command |
| --- | --- |
| MacOS | ```source .venv/bin/activate``` |
| Windows | ```.venv\Scripts\activate``` |

Install the required dependencies:

```bash
pip install -e ".[dev]"
```

### Running Dagster

Start the Dagster UI web server:

```bash
dg dev
```

Open http://localhost:3000 in your browser to see the project.

## Multi-source strategy

The bronze layer supports multiple source databases. Each source is a `SourceConfig` in
[`src/nvdatalake/defs/sources_config.py`](src/nvdatalake/defs/sources_config.py):

```python
SourceConfig(
    dbname="nvtr",                    # source database name
    schema="ce_caucaia_amostra",      # schema in that database
    tables=["auto_infracao", "agente", ...],
)
```

Each source's identity key is `<dbname>_<schema>` (e.g. `nvtr_ce_caucaia_amostra`), used to
namespace everything derived from it so two sources can never collide even if they share a
table name:

- Dagster resource: `source_db_<dbname>_<schema>` (e.g. `source_db_nvtr_ce_caucaia_amostra`)
- Dagster asset: `bronze_<dbname>_<schema>__<table>` (e.g. `bronze_nvtr_ce_caucaia_amostra__agente`)
- Bronze table in `nvdatalake`: `bronze.<dbname>_<schema>__<table>`

The env var prefix, however, is `SOURCE_<DBNAME>_` — grouped by `dbname` only, not
`dbname`+`schema`. Two `SourceConfig`s with the same `dbname` (different schemas of the same
physical database) automatically share one connection, no extra config needed: both
`nvtr_ce_caucaia_amostra` and `nvtr_ce_quixada` read `SOURCE_NVTR_DB_HOST/PORT/USER/PASSWORD/NAME`.

Currently configured: `nvtr` database with schemas `ce_caucaia_amostra` and `ce_quixada`.

### Schema drift between sources

Different source schemas can have different columns for the "same" table (e.g. one schema has
`pessoa.situacao_habilitacao`, the other doesn't). The `stg_*.sql` bronze models that union
multiple sources use **explicit column lists**, not `select *` — a column missing in one source
is filled with `null` on that side of the `union all`. When adding a source, diff its columns
against the existing `stg_*.sql` for that table and add any new column (`null` on the sources
that lack it) rather than switching back to `select *`, which breaks the union the moment column
counts or ordering differ across sources.

### Adding a new source

1. Append a `SourceConfig` to `SOURCES` in `sources_config.py` with `dbname`, `schema`, `tables`.
2. If no other source already has that `dbname`, set `SOURCE_<DBNAME>_DB_HOST/PORT/USER/PASSWORD/NAME`
   (or a single `SOURCE_<DBNAME>_DB_URL`) — or accept the localhost/postgres defaults. If a source
   with the same `dbname` already exists, its env vars are reused automatically.
3. Add the matching source table(s) and `stg_*.sql` model(s) in
   `dbt/nvdatalake/models/bronze/`, pointing at `source('bronze', '<dbname>_<schema>__<table>')`.
4. Re-run — a new bronze asset per table is generated automatically, no other code changes needed.

## Destination database

The data lake destination (`nvdatalake`) is identified by env vars — the same ones consumed on
both sides, so the Python loader (`definitions.py`) and dbt (`profiles.yml`) never drift apart:

| Env var | Default |
| --- | --- |
| `DATALAKE_DB_HOST` | `localhost` |
| `DATALAKE_DB_PORT` | `5432` |
| `DATALAKE_DB_USER` | `postgres` |
| `DATALAKE_DB_PASSWORD` | `postgres` |
| `DATALAKE_DB_NAME` | `nvdatalake` |

Unlike sources (one prefix per entry in `SOURCES`), there's only one destination, so these vars
have no name prefix. Leaving them unset falls back to the local defaults above.

To point at a different server:

```bash
export DATALAKE_DB_HOST=prod-db.example.com DATALAKE_DB_PORT=5432 DATALAKE_DB_USER=nvdatalake DATALAKE_DB_PASSWORD=changeme DATALAKE_DB_NAME=nvdatalake
```

### .env file

Instead of exporting vars by hand, copy [`.env.example`](../../.env.example) (repo root) to
`.env` and fill in real values — `.env` is gitignored, never commit credentials to it. Both
`docker-compose.yml` (via variable interpolation) and
[`scripts/materialize_all.sh`](../../scripts/materialize_all.sh) (via `source .env`) read it.

### Useful commands

List every asset key currently registered (useful before `--select`, since names are derived):

```bash
uv run python -c "from nvdatalake.definitions import defs; print(sorted(k.to_user_string() for k in defs.resolve_asset_graph().get_all_asset_keys()))"
```

Materialize one bronze asset (extract + land in `nvdatalake.bronze`):

```bash
uv run dagster asset materialize --select bronze_nvtr_ce_caucaia_amostra__agente -m nvdatalake.definitions
```

Materialize everything (all bronze sources + all dbt models, in dependency order). Note dbt
needs `DBT_PROFILES_DIR` pointed at the project-local `profiles.yml`, or it falls back to
`~/.dbt/profiles.yml` and its hardcoded `localhost` defaults:

```bash
export DBT_PROFILES_DIR="$(pwd)/../../dbt/nvdatalake"
uv run dagster asset materialize --select '*' -m nvdatalake.definitions
```

Or just run [`scripts/materialize_all.sh`](../../scripts/materialize_all.sh) from anywhere —
it sources `.env`, sets `DBT_PROFILES_DIR`, and runs the same command.

Run the test suite (structural tests always run; the bronze materialization test skips
automatically if the databases aren't reachable):

```bash
uv run pytest tests/ -v
```

Run dbt directly, without going through Dagster (useful for iterating on SQL):

```bash
cd ../../dbt/nvdatalake && uv run dbt build --select fac_auto_infracao+
```

## Learn more

To learn more about this template and Dagster in general:

- [Dagster Documentation](https://docs.dagster.io/)
- [Dagster University](https://courses.dagster.io/)
- [Dagster Slack Community](https://dagster.io/slack)
