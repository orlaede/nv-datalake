# Fato Gold Estrela Pura + API Joima Dims — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `gold.fac_auto_infracao` em fato estrela pura (só `sk_*` + atributos, sem rótulos) e mover para a API os joins de `gold.dim_*` e os CASEs de apresentação.

**Architecture:** Novo módulo `goldStarExpressions.ts` concentra FROM com joins + expressões SQL; `autoInfracaoFilters.ts` e `autosInfracao.ts` o consomem. Aliases de saída preservados (web/exports inalterados).

**Tech Stack:** dbt-postgres, PostgreSQL, Express + pg, Vitest, supertest.

**Spec:** `docs/superpowers/specs/2026-09-24-gold-estrela-pura-design.md`

---

### Task 1: dbt — fato gold estrela pura

**Files:**
- Modify: `dbt/nvdatalake/models/gold/fac_auto_infracao_gold.sql`

- [ ] **Step 1: Substituir conteúdo** por:

```sql
{{ config(alias='fac_auto_infracao') }}

select *
from {{ ref('fac_auto_infracao') }}
```

- [ ] **Step 2: Validar parse**

Run: `cd dbt && uv run dbt parse --project-dir nvdatalake --profiles-dir nvdatalake`
Expected: parse sem erros

- [ ] **Step 3 (DB acessível): build**

Run: `cd dbt && uv run dbt build --project-dir nvdatalake --profiles-dir nvdatalake --full-refresh --select fac_auto_infracao_gold fac_auto_infracao_mensal`
Expected: SUCCESS (fato gold recriado como estrela; mensal inalterado no conteúdo)

- [ ] **Step 4: Commit**

```bash
git add dbt/nvdatalake/models/gold/fac_auto_infracao_gold.sql
git commit -m "refactor(dbt): make gold fac_auto_infracao a pure star fact"
```

---

### Task 2: API — módulo `goldStarExpressions` + coluna parametrizada em `serieTemporal`

**Files:**
- Create: `apps/api/src/queries/goldStarExpressions.ts`
- Modify: `apps/api/src/queries/serieTemporal.ts`
- Modify: `apps/api/src/queries/serieTemporal.test.ts`

- [ ] **Step 1: Teste que falha para coluna customizada** — em `serieTemporal.test.ts`, adicionar dentro do describe de `bucketSqlExpression` (ou no nível raiz se houver):

```ts
  it("builds bucket expressions for a custom column", () => {
    expect(bucketSqlExpression("mes", "ai.data_hora")).toBe(`to_char(ai.data_hora, 'YYYY-MM')`)
    expect(bucketSqlExpression("hora", "ai.data_hora")).toBe(`EXTRACT(HOUR FROM ai.data_hora)`)
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npm test -- serieTemporal`
Expected: FAIL — segundo parâmetro não existe

- [ ] **Step 3: Implementar** — em `serieTemporal.ts`, mudar a assinatura e o corpo:

```ts
export function bucketSqlExpression(
  granularity: Granularity,
  column: string = '"Data e Hora"'
): string {
  switch (granularity) {
    case "hora":
      return `EXTRACT(HOUR FROM ${column})`
    case "diaSemana":
      return `EXTRACT(ISODOW FROM ${column})`
    case "dia":
      return `to_char(${column}, 'YYYY-MM-DD')`
    case "mes":
      return `to_char(${column}, 'YYYY-MM')`
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/api && npm test -- serieTemporal`
Expected: PASS (testes antigos usam o default, continuam válidos)

- [ ] **Step 5: Criar `apps/api/src/queries/goldStarExpressions.ts`**:

```ts
export const GOLD_STAR_FROM = `gold.fac_auto_infracao ai
       left join gold.dim_agente agente on agente.sk_agente = ai.sk_agente
       left join gold.dim_infracao infracao on infracao.sk_infracao = ai.sk_infracao
       left join gold.dim_origem origem on origem.sk_origem = ai.sk_origem`

export const AGENTE_EXPR = `agente.nome`
export const LOCAL_EXPR = `ai.logradouro`
export const TIPO_EXPR = `(case when infracao.abordagem = 'S' then 'Com Abordagem' else 'Sem Abordagem' end)`
export const CODIGO_EXPR = `infracao.codigo::text`
export const EQUIPAMENTO_EXPR = `ai.android_serial`
export const PERIODO_EXPR = `(case when extract(hour from ai.data_hora) >= 0 and extract(hour from ai.data_hora) < 12 then 'Manhã' when extract(hour from ai.data_hora) >= 12 and extract(hour from ai.data_hora) < 18 then 'Tarde' else 'Noite' end)`
export const DATA_HORA_EXPR = `ai.data_hora`
export const COMPETENCIA_EXPR = `(case when infracao.competencia = 'MUN/ROD' then 'Municipal/Rodoviário' when infracao.competencia = 'EST/MUN/ROD' then 'Estadual/Municipal/Rodoviário' when infracao.competencia = 'EST/ROD' then 'Estadual/Rodoviário' when infracao.competencia = 'EST' then 'Estadual' when infracao.competencia = 'ROD' then 'Rodoviário' when infracao.competencia = 'INDEFINIDA' then 'Indefinida' end)`
export const STATUS_EXPR = `(case when ai.status = 'CANCELADO_GESTOR' then 'Cancelado pelo Gestor' when ai.status = 'CANCELADO_OFF' then 'Cancelado pelo Agente' when ai.status = 'CANCELAMENTO_SOLICITADO_OFF' then 'Cancelamento Solicitado pelo Agente' when ai.status = 'VALIDO_OFF' then 'Válido' end)`
export const MOTIVO_CANCELAMENTO_EXPR = `coalesce(ai.justificativa_cancelamento, ai.justificativa_cancelamento_gestor)`
export const ORIGEM_EXPR = `origem.nome`
```

- [ ] **Step 6: Suite API verde (nada mais usa o módulo ainda)**

Run: `cd apps/api && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/queries/goldStarExpressions.ts apps/api/src/queries/serieTemporal.ts apps/api/src/queries/serieTemporal.test.ts
git commit -m "feat(api): add gold star expressions module and column param for buckets"
```

---

### Task 3: API — filtros com expressões da estrela (TDD)

**Files:**
- Modify: `apps/api/src/queries/autoInfracaoFilters.test.ts`
- Modify: `apps/api/src/queries/autoInfracaoFilters.ts`

- [ ] **Step 1: Atualizar asserções dos testes (vermelho)**

Em `autoInfracaoFilters.test.ts`, adicionar o import:

```ts
import {
  AGENTE_EXPR,
  CODIGO_EXPR,
  COMPETENCIA_EXPR,
  DATA_HORA_EXPR,
  EQUIPAMENTO_EXPR,
  LOCAL_EXPR,
  MOTIVO_CANCELAMENTO_EXPR,
  ORIGEM_EXPR,
  PERIODO_EXPR,
  TIPO_EXPR,
} from "./goldStarExpressions"
```

Substituir as asserções de cláusula pelos templates com expressões:

```ts
  it("returns empty clause and no params when no filters given", () => {
    const { clause, params } = buildAutoInfracaoWhere({})
    expect(clause).toBe("")
    expect(params).toEqual([])
  })

  it("builds an ILIKE clause with wildcards for free-text filters", () => {
    const { clause, params } = buildAutoInfracaoWhere({ agente: "vanessa" })
    expect(clause).toBe(`WHERE ${AGENTE_EXPR} ILIKE $1`)
    expect(params).toEqual(["%vanessa%"])
  })

  it("builds an equality clause for enum-like filters", () => {
    const { clause, params } = buildAutoInfracaoWhere({ periodo: "Manhã" })
    expect(clause).toBe(`WHERE ${PERIODO_EXPR} = $1`)
    expect(params).toEqual(["Manhã"])
  })

  it("casts codigo to text for comparison", () => {
    const { clause, params } = buildAutoInfracaoWhere({ codigo: "57380" })
    expect(clause).toBe(`WHERE ${CODIGO_EXPR} = $1`)
    expect(params).toEqual(["57380"])
  })

  it("coalesces both cancellation justification columns for motivo_cancelamento", () => {
    const { clause, params } = buildAutoInfracaoWhere({ motivo_cancelamento: "erro" })
    expect(clause).toBe(`WHERE ${MOTIVO_CANCELAMENTO_EXPR} ILIKE $1`)
    expect(params).toEqual(["%erro%"])
  })

  it("combines multiple filters with AND and positional params", () => {
    const { clause, params } = buildAutoInfracaoWhere({ agente: "vanessa", competencia: "Estadual/Rodoviário" })
    expect(clause).toBe(`WHERE ${AGENTE_EXPR} ILIKE $1 AND ${COMPETENCIA_EXPR} = $2`)
    expect(params).toEqual(["%vanessa%", "Estadual/Rodoviário"])
  })

  it("builds date time range filters for Data e Hora", () => {
    const { clause, params } = buildAutoInfracaoWhere({
      data_inicio: "2026-06-01T08:30",
      data_fim: "2026-06-30T18:45",
    })
    expect(clause).toBe(`WHERE ${DATA_HORA_EXPR} >= $1 AND ${DATA_HORA_EXPR} <= $2`)
    expect(params).toEqual(["2026-06-01T08:30", "2026-06-30T18:45"])
  })

  it("builds an equality clause for origem", () => {
    const { clause, params } = buildAutoInfracaoWhere({ origem: "Quixadá" })
    expect(clause).toBe(`WHERE ${ORIGEM_EXPR} = $1`)
    expect(params).toEqual(["Quixadá"])
  })

  it("ignores unknown/empty filter values", () => {
    const { clause, params } = buildAutoInfracaoWhere({ agente: "", local: undefined })
    expect(clause).toBe("")
    expect(params).toEqual([])
  })
```

(Adicionar também um caso para `tipo` e `equipamento`/`local` se quiser cobertura simétrica — mínimo: manter os casos acima.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npm test -- autoInfracaoFilters`
Expected: FAIL — cláusulas ainda com colunas quoted

- [ ] **Step 3: Implementar** — em `autoInfracaoFilters.ts`:

```ts
import {
  AGENTE_EXPR,
  CODIGO_EXPR,
  COMPETENCIA_EXPR,
  DATA_HORA_EXPR,
  EQUIPAMENTO_EXPR,
  LOCAL_EXPR,
  MOTIVO_CANCELAMENTO_EXPR,
  ORIGEM_EXPR,
  PERIODO_EXPR,
  TIPO_EXPR,
} from "./goldStarExpressions"

const CONDITION_BY_FILTER: Record<keyof AutoInfracaoFilters, ConditionBuilder> = {
  agente: (i) => `${AGENTE_EXPR} ILIKE $${i}`,
  local: (i) => `${LOCAL_EXPR} ILIKE $${i}`,
  tipo: (i) => `${TIPO_EXPR} = $${i}`,
  codigo: (i) => `${CODIGO_EXPR} = $${i}`,
  equipamento: (i) => `${EQUIPAMENTO_EXPR} ILIKE $${i}`,
  periodo: (i) => `${PERIODO_EXPR} = $${i}`,
  data_inicio: (i) => `${DATA_HORA_EXPR} >= $${i}`,
  data_fim: (i) => `${DATA_HORA_EXPR} <= $${i}`,
  competencia: (i) => `${COMPETENCIA_EXPR} = $${i}`,
  motivo_cancelamento: (i) => `${MOTIVO_CANCELAMENTO_EXPR} ILIKE $${i}`,
  origem: (i) => `${ORIGEM_EXPR} = $${i}`,
}
```

(`LIKE_FILTERS` e o resto do arquivo inalterados.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/api && npm test -- autoInfracaoFilters`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/queries/autoInfracaoFilters.ts apps/api/src/queries/autoInfracaoFilters.test.ts
git commit -m "refactor(api): build filter clauses from gold star expressions"
```

---

### Task 4: API — rotas joimam dims gold (TDD)

**Files:**
- Modify: `apps/api/src/routes/autosInfracao.test.ts`
- Modify: `apps/api/src/routes/autosInfracao.ts`

- [ ] **Step 1: Atualizar asserções dos testes (vermelho)**

Em `autosInfracao.test.ts`, adicionar os imports:

```ts
import {
  AGENTE_EXPR,
  CODIGO_EXPR,
  COMPETENCIA_EXPR,
  EQUIPAMENTO_EXPR,
  GOLD_STAR_FROM,
  MOTIVO_CANCELAMENTO_EXPR,
  STATUS_EXPR,
  TIPO_EXPR,
} from "../queries/goldStarExpressions"
```

Atualizar as asserções (todas as ocorrências):

- `expect(countCall[0]).toContain(`WHERE "Nome do Agente" ILIKE $1`)` → `` `WHERE ${AGENTE_EXPR} ILIKE $1` ``
- `"Código da Infração"::text AS codigo` → `` `${CODIGO_EXPR} AS codigo` ``
- `"Número do Auto"::text AS numero_auto` → `` `ai.num_auto::text AS numero_auto` ``
- `"Equipamento" AS equipamento` → `` `${EQUIPAMENTO_EXPR} AS equipamento` ``
- `"Turno" AS periodo` → `AS periodo` (assert contém `AS periodo`)
- `"Competência" AS competencia` → `` `${COMPETENCIA_EXPR} AS competencia` ``
- `COALESCE("Justificativa do Cancelamento pelo Agente", "Justificativa do Cancelamento pelo Gestor") AS motivo_cancelamento` → `` `${MOTIVO_CANCELAMENTO_EXPR} AS motivo_cancelamento` ``
- `"Status do Auto" AS status` → `` `${STATUS_EXPR} AS status` ``
- `expect(countCall[0]).toContain("FROM gold.fac_auto_infracao")` → `` expect(countCall[0]).toContain(`FROM ${GOLD_STAR_FROM}`) `` (idem listCall)
- `LIMIT $2 OFFSET $3` e `listCall[1]` params: inalterados
- Stats: `"Nome do Agente" AS agente` → `` `${AGENTE_EXPR} AS agente` ``; `"Competência" = $1 AND (` → `` `${COMPETENCIA_EXPR} = $1 AND (` ``; `COUNT(DISTINCT "Nome do Agente")` → `` `COUNT(DISTINCT ${AGENTE_EXPR})` ``; `COUNT(DISTINCT "Equipamento")` → `` `COUNT(DISTINCT ${EQUIPAMENTO_EXPR})` ``; `EXTRACT(ISODOW FROM "Data e Hora")` → `` `EXTRACT(ISODOW FROM ai.data_hora)` ``; `"Tipo Infração" AS tipo` → `` `${TIPO_EXPR} AS tipo` ``
- Suggestions: `"Nome do Agente" AS value` → `` `${AGENTE_EXPR} AS value` ``; `"Código da Infração"::text AS value` → `` `${CODIGO_EXPR} AS value` ``; `"Equipamento" AS value` → `` `${EQUIPAMENTO_EXPR} AS value` ``; `COALESCE(...) AS value` → `` `${MOTIVO_CANCELAMENTO_EXPR} AS value` ``

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npm test -- autosInfracao`
Expected: FAIL — SQL ainda com colunas quoted e sem joins

- [ ] **Step 3: Refatorar `autosInfracao.ts`**

Imports novos (após os existentes):

```ts
import {
  AGENTE_EXPR,
  CODIGO_EXPR,
  COMPETENCIA_EXPR,
  DATA_HORA_EXPR,
  EQUIPAMENTO_EXPR,
  GOLD_STAR_FROM,
  LOCAL_EXPR,
  MOTIVO_CANCELAMENTO_EXPR,
  PERIODO_EXPR,
  STATUS_EXPR,
  TIPO_EXPR,
} from "../queries/goldStarExpressions"
```

Remover `const VIEW = "gold.fac_auto_infracao"`. Substituir `LIST_COLUMNS_SQL`:

```ts
const LIST_COLUMNS_SQL = `
       ai.data_hora AS data_hora,
       ${AGENTE_EXPR} AS agente,
       ${LOCAL_EXPR} AS local,
       ${TIPO_EXPR} AS tipo,
       ${CODIGO_EXPR} AS codigo,
       ai.num_auto::text AS numero_auto,
       ${EQUIPAMENTO_EXPR} AS equipamento,
       ${PERIODO_EXPR} AS periodo,
       ${COMPETENCIA_EXPR} AS competencia,
       ${MOTIVO_CANCELAMENTO_EXPR} AS motivo_cancelamento,
       ${STATUS_EXPR} AS status`
```

`GROUP_COLUMN_EXPR` (substituir entradas; chaves de data usam `ai.data_hora`):

```ts
const GROUP_COLUMN_EXPR: Record<GroupKey, string> = {
  numero_auto: `ai.num_auto::text`,
  data_hora: DATA_HORA_EXPR,
  agente: AGENTE_EXPR,
  codigo: CODIGO_EXPR,
  local: LOCAL_EXPR,
  tipo: TIPO_EXPR,
  equipamento: EQUIPAMENTO_EXPR,
  periodo: PERIODO_EXPR,
  competencia: COMPETENCIA_EXPR,
  motivo_cancelamento: MOTIVO_CANCELAMENTO_EXPR,
  status: STATUS_EXPR,
  ano: `to_char(ai.data_hora, 'YYYY')`,
  mes: `to_char(ai.data_hora, 'YYYY-MM')`,
  dia: `to_char(ai.data_hora, 'YYYY-MM-DD')`,
  hora: `to_char(ai.data_hora, 'HH24')`,
  semana_ano: `to_char(ai.data_hora, 'IYYY-"W"IW')`,
  dia_semana: `case extract(isodow from ai.data_hora) when 1 then 'Segunda-feira' when 2 then 'Terça-feira' when 3 then 'Quarta-feira' when 4 then 'Quinta-feira' when 5 then 'Sexta-feira' when 6 then 'Sábado' else 'Domingo' end`,
}
```

`SUGGESTION_FIELDS`:

```ts
const SUGGESTION_FIELDS = {
  agente: AGENTE_EXPR,
  local: LOCAL_EXPR,
  codigo: CODIGO_EXPR,
  equipamento: EQUIPAMENTO_EXPR,
  motivo_cancelamento: MOTIVO_CANCELAMENTO_EXPR,
} as const
```

Em TODAS as queries, trocar `FROM ${VIEW}` por `FROM ${GOLD_STAR_FROM}` (rotas list,
groups, group-rows, export, stats×10, suggestions). Trocar todo `"Data e Hora"` por
`ai.data_hora` em ORDER BY / ROW_NUMBER / to_char dos stats. Chamada do bucket:
`bucketSqlExpression(granularity, DATA_HORA_EXPR)`. Cláusula de cancelamento:

```ts
  const cancelamentoClause = clause
    ? `${clause} AND (${MOTIVO_CANCELAMENTO_EXPR} IS NOT NULL)`
    : `WHERE ${MOTIVO_CANCELAMENTO_EXPR} IS NOT NULL`
```

Queries de stats (trocar colunas quoted): `SELECT COUNT(*) FROM ${GOLD_STAR_FROM} ${clause}`;
porAgente: `` SELECT ${AGENTE_EXPR} AS agente, COUNT(*) AS total FROM ${GOLD_STAR_FROM} ${clause} GROUP BY agente ORDER BY total DESC LIMIT 10 ``; numAgentes: `` COUNT(DISTINCT ${AGENTE_EXPR}) ``; numEquipamentos: `` COUNT(DISTINCT ${EQUIPAMENTO_EXPR}) ``; porTipo: `` SELECT ${TIPO_EXPR} AS tipo, ... ``; porCompetencia: `` SELECT ${COMPETENCIA_EXPR} AS competencia, ... ``; mes atual/anterior: `` SELECT to_char(ai.data_hora, 'YYYY-MM') AS ym, ... ``.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/api && npm test`
Expected: PASS (suite inteira)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/autosInfracao.ts apps/api/src/routes/autosInfracao.test.ts
git commit -m "refactor(api): join gold dimensions in autos queries instead of wide labels"
```

---

### Task 5: Verificação final + README

**Files:**
- Modify: `README.md` (seção "📊 Camadas de Dados")

- [ ] **Step 1: Atualizar linha do Gold** para:

```markdown
- **Gold**: Camada de apresentação autocontida: dimensões espelhadas em `gold.*` (incluindo `dim_origem`, derivada do `source_key`) e fatos estrela pura com surrogate keys (`fac_auto_infracao` com as 8 `sk_*` + atributos do auto, `fac_auto_infracao_mensal` com `sk_origem`). Os rótulos e CASEs de apresentação são montados pela API ao joimar as dimensões.
```

- [ ] **Step 2: Rodar todas as suítes**

```bash
cd apps/api && npm test
cd apps/web && npm test
cd dbt && uv run dbt parse --project-dir nvdatalake --profiles-dir nvdatalake
```

Expected: API e web 100%, parse limpo.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe gold star facts and api-side presentation"
```

---

## Notas de execução

- **Ordem de deploy**: `dbt build --full-refresh` → API. API nova exige o fato estrela; API antiga com gold novo quebra (colunas quoted sumiram).
- **Web**: nenhuma mudança — aliases de resposta preservados.
- **`/origens`**: inalterado (lê `gold.dim_origem` direto).
