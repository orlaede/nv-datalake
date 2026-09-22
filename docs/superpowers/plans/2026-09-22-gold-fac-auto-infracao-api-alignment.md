# Gold `fac_auto_infracao` API Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy `ce_eusebio.vw_bi_auto_infracao` dependency with the dbt-generated `gold.fac_auto_infracao` fact table while preserving the web/API response contract.

**Architecture:** Create a denormalized Gold dbt model from `silver.fac_auto_infracao`, `silver.dim_agente`, and `silver.dim_infracao`, using the supplied business rules and the API's existing Portuguese column names. Update the API's single relation constant to `gold.fac_auto_infracao`; existing filters, grouping, statistics, and exports then reuse the same contract. Configure API database access to consume the repository's `DATALAKE_DB_*` variables with explicit SSL behavior.

**Tech Stack:** PostgreSQL, dbt, TypeScript, Express, `pg`, Vitest.

---

### Task 1: Lock the API relation contract with a failing test

**Files:**
- Modify: `apps/api/src/routes/autosInfracao.test.ts`

- [ ] **Step 1: Add an assertion that list queries use Gold**

Extend the existing paginated-list test after the existing SQL assertions:

```ts
expect(countCall[0]).toContain("FROM gold.fac_auto_infracao")
expect(listCall[0]).toContain("FROM gold.fac_auto_infracao")
expect(countCall[0]).not.toContain("ce_eusebio.vw_bi_auto_infracao")
expect(listCall[0]).not.toContain("ce_eusebio.vw_bi_auto_infracao")
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run from `apps/api` with the available API dependencies:

```bash
NODE_PATH=/Users/roberto/Documents/dev/novaviadata/apps/api/node_modules \
/Users/roberto/Documents/dev/novaviadata/apps/api/node_modules/.bin/vitest run \
/Users/roberto/Documents/dev/nv-datalake/nv-datalake/apps/api/src/routes/autosInfracao.test.ts
```

Expected result: FAIL because the current SQL still contains `ce_eusebio.vw_bi_auto_infracao`.

### Task 2: Create the Gold fact model from the supplied business rules

**Files:**
- Create: `dbt/nvdatalake/models/gold/fac_auto_infracao_gold.sql`

- [ ] **Step 1: Add the model with the API-facing columns**

Build from `silver.fac_auto_infracao ai`, joining `silver.dim_agente agente` by `sk_agente` and `silver.dim_infracao infracao` by `sk_infracao`. Select the supplied aliases exactly, including `date_part`, weekday, shift, competence, and status mappings. Use `ai.android_serial` for `Equipamento`, equivalent to `a2.serial` in the source view query. Set `{{ config(alias='fac_auto_infracao') }}` so the logical dbt name remains unique while the physical relation is `gold.fac_auto_infracao`.

- [ ] **Step 2: Validate the model SQL statically**

Run:

```bash
rg -n "from|join|Data e Hora|Equipamento|Turno|Competência|Status do Auto" \
  dbt/nvdatalake/models/gold/fac_auto_infracao.sql
```

Expected result: the model contains only Gold-compatible `silver` references and all API-facing fields.

### Task 3: Point every API endpoint at the Gold fact table

**Files:**
- Modify: `apps/api/src/routes/autosInfracao.ts:131`

- [ ] **Step 1: Replace the legacy relation constant**

Change the relation value:

```ts
const VIEW = "gold.fac_auto_infracao"
```

Keep the existing `VIEW` constant name to minimize the route diff; all endpoints already interpolate it. Keep the existing quoted API-facing column names because the Gold model exposes those exact aliases.

- [ ] **Step 2: Run the focused API tests and verify they pass**

Run the Vitest command from Task 1. Expected result: all tests in `autosInfracao.test.ts` pass.

### Task 4: Align API connection configuration with the final Data Lake database

**Files:**
- Modify: `apps/api/src/db.ts`
- Create: `apps/api/src/db.test.ts`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Add tests for `DATALAKE_DB_*` configuration and SSL requirement**

Cover these behaviors: the pool config uses `DATALAKE_DB_HOST`, `DATALAKE_DB_PORT`, `DATALAKE_DB_USER`, `DATALAKE_DB_PASSWORD`, and `DATALAKE_DB_NAME` when `DATABASE_URL` is absent; SSL is enabled by default; and a configured CA can enable certificate verification.

- [ ] **Step 2: Implement the minimal configuration fallback**

Keep `DATABASE_URL` supported, but allow the final repository variables to configure the pool directly. Default to encrypted PostgreSQL transport and expose an explicit CA-file option for production certificate verification.

- [ ] **Step 3: Document the required API variables**

Update `apps/api/.env.example` with the final Data Lake variables and SSL setting without including credentials.

### Task 5: Validate locally and against the AWS PostgreSQL database

**Files:**
- No additional files.

- [ ] **Step 1: Run API tests**

Run the API test suite and confirm zero failures.

- [ ] **Step 2: Parse/build the dbt project**

Run `uv run --no-project --with dbt-postgres dbt parse --project-dir dbt/nvdatalake --profiles-dir dbt/nvdatalake`.

- [ ] **Step 3: Materialize the Gold model against the configured database**

Run `uv run --no-project --with dbt-postgres dbt build --select fac_auto_infracao_gold --project-dir dbt/nvdatalake --profiles-dir dbt/nvdatalake` with the repository `.env` loaded, then query `gold.fac_auto_infracao` for its row count and required columns.

- [ ] **Step 4: Smoke-test the API SQL contract**

Confirm the relation exists in `gold`, the API's expected columns are present, and the legacy `ce_eusebio.vw_bi_auto_infracao` relation is no longer referenced by `apps/api`.
