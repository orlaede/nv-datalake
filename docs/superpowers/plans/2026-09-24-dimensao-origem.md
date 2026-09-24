# Dimensão Origem (source_key) + Filtro de Origem — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promover o `source_key` a dimensão (`dim_origem`, silver → espelhada no gold), ligá-la aos fatos via `sk_origem`, expor "Origem" no fato gold e adicionar filtro geral de origem ("Todas as origens") na interface, antes dos filtros de data.

**Architecture:** Medallion: nova `dim_origem` em silver deriva de `stg_auto_infracao`; fatos silver ganham `sk_origem`; gold recebe 7 models espelho das dims (padrão `*_gold.sql` + `config(alias=...)`) e fatos gold joiram somente dims gold. API ganha filtro `origem` em `buildAutoInfracaoWhere` + endpoint `/api/autos-infracao/origens`. Web ganha `OrigemSelector` em `FiltersControls` (antes do `PeriodSelector`).

**Tech Stack:** dbt-postgres, PostgreSQL, Express + pg, React + Vite + @tanstack/react-query + @base-ui/react, Vitest, supertest.

**Spec:** `docs/superpowers/specs/2026-09-24-dimensao-origem-design.md`

---

### Task 1: dbt silver — `dim_origem` + `sk_origem` no fato

**Files:**
- Create: `dbt/nvdatalake/models/silver/dim_origem.sql`
- Create: `dbt/nvdatalake/tests/assert_dim_origem_source_key_unique.sql`
- Modify: `dbt/nvdatalake/models/silver/fac_auto_infracao.sql`

- [ ] **Step 1: Criar `dim_origem.sql`**

```sql
with origens as (
    select distinct source_key
    from {{ ref('stg_auto_infracao') }}
)

select
    row_number() over (order by source_key) as sk_origem,
    source_key,
    case source_key
        when 'nvtr_ce_caucaia_amostra' then 'Caucaia (Amostra)'
        when 'nvtr_ce_quixada' then 'Quixadá'
        else source_key
    end as nome
from origens
```

- [ ] **Step 2: Criar teste singular de unicidade `tests/assert_dim_origem_source_key_unique.sql`**

```sql
select source_key
from {{ ref('dim_origem') }}
group by source_key
having count(*) > 1
```

- [ ] **Step 3: Adicionar `sk_origem` ao fato silver**

Em `dbt/nvdatalake/models/silver/fac_auto_infracao.sql`, no bloco `select`, adicionar
logo após `f.source_key,`:

```sql
    coalesce(origem.sk_origem, 0) as sk_origem,
```

Ao final do arquivo, após o join com `dim_erro_consistencia`, adicionar:

```sql
left join {{ ref('dim_origem') }} origem
    on f.source_key = origem.source_key
```

- [ ] **Step 4: Validar parse do dbt**

Run: `cd dbt && uv run dbt parse --project-dir nvdatalake --profiles-dir nvdatalake`
Expected: `Parsing completed successfully` (sem erros de compilação jinja/refs)

- [ ] **Step 5 (opcional, requer DB acessível): construir e testar**

Run: `cd dbt && uv run dbt build --project-dir nvdatalake --profiles-dir nvdatalake --select dim_origem fac_auto_infracao+`
Expected: SUCCESS (2 models + 1 test pass)

- [ ] **Step 6: Commit**

```bash
git add dbt/nvdatalake/models/silver/dim_origem.sql dbt/nvdatalake/tests/assert_dim_origem_source_key_unique.sql dbt/nvdatalake/models/silver/fac_auto_infracao.sql
git commit -m "feat(dbt): add dim_origem and sk_origem to silver fact"
```

---

### Task 2: dbt gold — 7 dimensões espelhadas + fatos com Origem

**Files:**
- Create: `dbt/nvdatalake/models/gold/dim_agente_gold.sql`
- Create: `dbt/nvdatalake/models/gold/dim_infracao_gold.sql`
- Create: `dbt/nvdatalake/models/gold/dim_municipio_gold.sql`
- Create: `dbt/nvdatalake/models/gold/dim_pessoa_gold.sql`
- Create: `dbt/nvdatalake/models/gold/dim_veiculo_gold.sql`
- Create: `dbt/nvdatalake/models/gold/dim_erro_consistencia_gold.sql`
- Create: `dbt/nvdatalake/models/gold/dim_origem_gold.sql`
- Modify: `dbt/nvdatalake/models/gold/fac_auto_infracao_gold.sql`
- Modify: `dbt/nvdatalake/models/gold/fac_auto_infracao_mensal.sql`

- [ ] **Step 1: Criar os 7 models espelho** (tabelas em `gold.*` via `alias`; materialização tabela vem do default gold em `dbt_project.yml`)

`dim_agente_gold.sql`:
```sql
{{ config(alias='dim_agente') }}

select *
from {{ ref('dim_agente') }}
```

`dim_infracao_gold.sql`:
```sql
{{ config(alias='dim_infracao') }}

select *
from {{ ref('dim_infracao') }}
```

`dim_municipio_gold.sql`:
```sql
{{ config(alias='dim_municipio') }}

select *
from {{ ref('dim_municipio') }}
```

`dim_pessoa_gold.sql`:
```sql
{{ config(alias='dim_pessoa') }}

select *
from {{ ref('dim_pessoa') }}
```

`dim_veiculo_gold.sql`:
```sql
{{ config(alias='dim_veiculo') }}

select *
from {{ ref('dim_veiculo') }}
```

`dim_erro_consistencia_gold.sql`:
```sql
{{ config(alias='dim_erro_consistencia') }}

select *
from {{ ref('dim_erro_consistencia') }}
```

`dim_origem_gold.sql`:
```sql
{{ config(alias='dim_origem') }}

select *
from {{ ref('dim_origem') }}
```

- [ ] **Step 2: Fato gold — trocar joins para dims gold e expor "Origem"**

Em `dbt/nvdatalake/models/gold/fac_auto_infracao_gold.sql`:

Adicionar a coluna `"Origem"` após a linha `ai.android_serial as "Equipamento",`:

```sql
    origem.nome as "Origem",
```

Trocar os dois joins do final do arquivo por:

```sql
left join {{ ref('dim_agente_gold') }} agente
    on agente.sk_agente = ai.sk_agente
left join {{ ref('dim_infracao_gold') }} infracao
    on infracao.sk_infracao = ai.sk_infracao
left join {{ ref('dim_origem_gold') }} origem
    on origem.sk_origem = ai.sk_origem
```

- [ ] **Step 3: Fato mensal — adicionar `sk_origem` à granularidade**

Substituir o conteúdo de `dbt/nvdatalake/models/gold/fac_auto_infracao_mensal.sql` por:

```sql
select
    date_trunc('month', data_hora) as mes,
    sk_origem,
    sk_infracao,
    sk_agente,
    medicao_id,
    count(*) as total_autos
from {{ ref('fac_auto_infracao') }}
group by 1, 2, 3, 4, 5
```

- [ ] **Step 4: Validar parse**

Run: `cd dbt && uv run dbt parse --project-dir nvdatalake --profiles-dir nvdatalake`
Expected: `Parsing completed successfully`

- [ ] **Step 5 (opcional, requer DB): construir tudo**

Run: `cd dbt && uv run dbt build --project-dir nvdatalake --profiles-dir nvdatalake --full-refresh`
Expected: SUCCESS (todos models + tests)

- [ ] **Step 6: Commit**

```bash
git add dbt/nvdatalake/models/gold/
git commit -m "feat(dbt): mirror dimensions in gold and expose Origem in gold facts"
```

---

### Task 3: API — filtro `origem` (TDD)

**Files:**
- Modify: `apps/api/src/queries/autoInfracaoFilters.test.ts`
- Modify: `apps/api/src/queries/autoInfracaoFilters.ts`
- Modify: `apps/api/src/routes/autosInfracao.ts:185-198` (extractFilters)

- [ ] **Step 1: Escrever teste que falha**

Em `apps/api/src/queries/autoInfracaoFilters.test.ts`, adicionar dentro do `describe`:

```ts
  it("builds an equality clause for origem", () => {
    const { clause, params } = buildAutoInfracaoWhere({ origem: "Quixadá" })
    expect(clause).toBe(`WHERE "Origem" = $1`)
    expect(params).toEqual(["Quixadá"])
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npm test -- autoInfracaoFilters`
Expected: FAIL — `origem` não filtra (clause vazio)

- [ ] **Step 3: Implementar**

Em `apps/api/src/queries/autoInfracaoFilters.ts`:

No type `AutoInfracaoFilters`, adicionar apenas o campo `origem` (não adicionar
`periodo_data` — ele não tem condition builder e quebraria o `Record<keyof ...>`):

```ts
export type AutoInfracaoFilters = {
  agente?: string
  local?: string
  tipo?: string
  codigo?: string
  equipamento?: string
  periodo?: string
  data_inicio?: string
  data_fim?: string
  competencia?: string
  motivo_cancelamento?: string
  origem?: string
}
```

Em `CONDITION_BY_FILTER`, adicionar a entrada:

```ts
  origem: (i) => `"Origem" = $${i}`,
```

(`origem` NÃO entra em `LIKE_FILTERS` — igualdade exata.)

Em `apps/api/src/routes/autosInfracao.ts`, dentro de `extractFilters`, adicionar:

```ts
    origem: typeof query.origem === "string" ? query.origem : undefined,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/api && npm test -- autoInfracaoFilters`
Expected: PASS (todos os testes, incluindo o novo)

- [ ] **Step 5: Teste de integração do endpoint de listagem com origem**

Em `apps/api/src/routes/autosInfracao.test.ts`, dentro do `describe("GET /api/autos-infracao")`, adicionar:

```ts
  it("passes the origem filter through to the query", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ count: "0" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)

    const app = createApp()
    const res = await request(app).get("/api/autos-infracao").query({ origem: "Quixadá" })

    expect(res.status).toBe(200)
    const [countCall, listCall] = vi.mocked(pool.query).mock.calls
    expect(countCall[0]).toContain(`WHERE "Origem" = $1`)
    expect(listCall[0]).toContain(`WHERE "Origem" = $1`)
    expect(listCall[1]).toEqual(["Quixadá", 20, 0])
  })
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd apps/api && npm test -- autosInfracao`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/queries/autoInfracaoFilters.ts apps/api/src/queries/autoInfracaoFilters.test.ts apps/api/src/routes/autosInfracao.ts apps/api/src/routes/autosInfracao.test.ts
git commit -m "feat(api): filter autos by origem"
```

---

### Task 4: API — endpoint `/api/autos-infracao/origens` (TDD)

**Files:**
- Modify: `apps/api/src/routes/autosInfracao.test.ts`
- Modify: `apps/api/src/routes/autosInfracao.ts`

- [ ] **Step 1: Escrever teste que falha**

Em `apps/api/src/routes/autosInfracao.test.ts`, adicionar um novo `describe` no nível raiz:

```ts
describe("GET /api/autos-infracao/origens", () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset()
  })

  it("returns origin names ordered from gold.dim_origem", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ nome: "Caucaia (Amostra)" }, { nome: "Quixadá" }],
    } as never)

    const app = createApp()
    const res = await request(app).get("/api/autos-infracao/origens")

    expect(res.status).toBe(200)
    expect(res.body.origens).toEqual(["Caucaia (Amostra)", "Quixadá"])

    const [call] = vi.mocked(pool.query).mock.calls
    expect(call[0]).toContain("FROM gold.dim_origem")
    expect(call[0]).toContain("ORDER BY nome")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npm test -- autosInfracao`
Expected: FAIL — rota 404

- [ ] **Step 3: Implementar a rota**

Em `apps/api/src/routes/autosInfracao.ts`, adicionar após a definição do router (antes da rota `/api/autos-infracao` existente):

```ts
autosInfracaoRouter.get("/api/autos-infracao/origens", async (_req, res) => {
  const result = await pool.query(`SELECT nome FROM gold.dim_origem ORDER BY nome`)
  res.json({ origens: result.rows.map((row) => row.nome) })
})
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/api && npm test`
Expected: PASS (suite inteira da API)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/autosInfracao.ts apps/api/src/routes/autosInfracao.test.ts
git commit -m "feat(api): add origens endpoint for source dimension"
```

---

### Task 5: Web — `origem` em FILTER_KEYS + `OrigemSelector` (TDD)

**Files:**
- Modify: `apps/web/src/lib/use-filters.ts:3-15`
- Create: `apps/web/src/components/dashboard/OrigemSelector.tsx`
- Create: `apps/web/src/components/dashboard/OrigemSelector.test.tsx`

- [ ] **Step 1: Adicionar `"origem"` a `FILTER_KEYS`**

Em `apps/web/src/lib/use-filters.ts`:

```ts
export const FILTER_KEYS = [
  "origem",
  "agente",
  "local",
  "tipo",
  "codigo",
  "equipamento",
  "periodo",
  "periodo_data",
  "data_inicio",
  "data_fim",
  "competencia",
  "motivo_cancelamento",
] as const
```

- [ ] **Step 2: Escrever teste que falha**

Criar `apps/web/src/components/dashboard/OrigemSelector.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { OrigemSelector } from "./OrigemSelector"

function renderOrigemSelector(initialEntry = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <OrigemSelector />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function mockOrigensFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ origens: ["Caucaia (Amostra)", "Quixadá"] }),
    })
  )
}

describe("OrigemSelector", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders Todas as origens by default when no origem param is set", async () => {
    mockOrigensFetch()
    renderOrigemSelector()

    const trigger = screen.getByRole("combobox", { name: "Origem dos dados" })
    expect(trigger).toBeInTheDocument()
    expect(await screen.findByText("Todas as origens")).toBeInTheDocument()
  })

  it("displays the origem selected via URL param", async () => {
    mockOrigensFetch()
    renderOrigemSelector("/?origem=Quixad%C3%A1")

    expect(await screen.findByText("Quixadá")).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd apps/web && npm test -- OrigemSelector`
Expected: FAIL — componente não existe

- [ ] **Step 4: Implementar `OrigemSelector`**

Criar `apps/web/src/components/dashboard/OrigemSelector.tsx` (mesmo padrão de
`SelectFilter` em `FilterBar.tsx`, com sentinela própria):

```tsx
import { useQuery } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiGet } from "@/lib/api"
import { useFilters } from "@/lib/use-filters"

const ALL_ORIGENS_VALUE = "__todas_origens__"

type OrigensResponse = {
  origens: string[]
}

export function OrigemSelector() {
  const { filters, setFilter } = useFilters()
  const { data } = useQuery({
    queryKey: ["autos-infracao-origens"],
    queryFn: () => apiGet<OrigensResponse>("/api/autos-infracao/origens", {}),
  })
  const origens = data?.origens ?? []

  const labelByValue: Record<string, string> = { [ALL_ORIGENS_VALUE]: "Todas as origens" }
  for (const origem of origens) labelByValue[origem] = origem

  return (
    <Select
      value={filters.origem ?? ALL_ORIGENS_VALUE}
      onValueChange={(value) =>
        setFilter("origem", !value || value === ALL_ORIGENS_VALUE ? "" : value)
      }
    >
      <SelectTrigger className="bg-card shadow-sm" aria-label="Origem dos dados">
        <SelectValue placeholder="Origem">
          {(value: string) => labelByValue[value] ?? "Todas as origens"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_ORIGENS_VALUE}>Todas as origens</SelectItem>
        {origens.map((origem) => (
          <SelectItem key={origem} value={origem}>
            {origem}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd apps/web && npm test -- OrigemSelector`
Expected: PASS (2 testes)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/use-filters.ts apps/web/src/components/dashboard/OrigemSelector.tsx apps/web/src/components/dashboard/OrigemSelector.test.tsx
git commit -m "feat(web): add origem filter key and OrigemSelector component"
```

---

### Task 6: Web — posicionar `OrigemSelector` antes dos filtros de data

**Files:**
- Modify: `apps/web/src/components/dashboard/FiltersControls.tsx`

- [ ] **Step 1: Inserir `OrigemSelector` antes do `PeriodSelector`**

Substituir o conteúdo de `apps/web/src/components/dashboard/FiltersControls.tsx` por:

```tsx
import { useRef } from "react"
import { OrigemSelector } from "@/components/dashboard/OrigemSelector"
import { PeriodSelector } from "@/components/dashboard/PeriodSelector"
import { FilterDrawer, type FilterDrawerHandle } from "@/components/dashboard/FilterDrawer"

export function FiltersControls() {
  const drawerRef = useRef<FilterDrawerHandle>(null)

  return (
    <>
      <OrigemSelector />
      <PeriodSelector onCustomSelected={() => drawerRef.current?.open()} />
      <FilterDrawer ref={drawerRef} />
    </>
  )
}
```

(O Dashboard e a Listagem herdam o filtro automaticamente — ambos usam `FiltersControls`.)

- [ ] **Step 2: Rodar testes do web**

Run: `cd apps/web && npm test`
Expected: PASS (suite inteira — inclui `FiltersControls.test.tsx` e `FilterBar.test.tsx` existentes; o stub de `fetch` deles responde `{ suggestions: [] }` para a query de origens, o que degrada para lista vazia sem quebrar)

- [ ] **Step 3: Lint**

Run: `cd apps/web && npm run lint`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/FiltersControls.tsx
git commit -m "feat(web): place origem selector before date filters"
```

---

### Task 7: Verificação final + README

**Files:**
- Modify: `README.md:274-278` (seção "Camadas de Dados")

- [ ] **Step 1: Atualizar README**

Na seção "📊 Camadas de Dados", atualizar as linhas de Silver e Gold:

```markdown
- **Silver**: Modelos dimensionais higienizados e relacionados, com surrogate keys (`sk_*`) por dimensão (`dim_agente`, `dim_infracao`, `dim_municipio`, `dim_pessoa`, `dim_veiculo`, `dim_erro_consistencia`, `dim_origem`, `fac_auto_infracao`).
- **Gold**: Camada de apresentação autocontida: dimensões espelhadas em `gold.*` (incluindo `dim_origem`, derivada do `source_key`) e fatos (`fac_auto_infracao` com coluna "Origem", `fac_auto_infracao_mensal` com `sk_origem`).
```

- [ ] **Step 2: Rodar todas as suítes**

```bash
cd apps/api && npm test
cd apps/web && npm test
cd dbt && uv run dbt parse --project-dir nvdatalake --profiles-dir nvdatalake
```

Expected: PASS / `Parsing completed successfully`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe origem dimension and gold presentation layer"
```

---

## Notas de execução

- **Ordem importa**: Tasks 1–2 (dbt) antes da Task 4 — o endpoint consulta `gold.dim_origem`, que só existe após `dbt build`. Em ambiente sem DB, o `dbt parse` valida sintaxe; o build real acontece no deploy (`scripts/materialize_all.sh` ou Docker).
- **Compatibilidade**: colunas novas não quebram consumidores antigos; o filtro `origem` só é enviado pela web nova; API nova funciona com gold antigo (coluna "Origem" ausente só daria erro se alguém filtrasse por origem — cenário não suportado até o `dbt build` rodar).
- **Testes de popup do select**: os testes do `OrigemSelector` evitam abrir o popup do base-ui (frágil em jsdom), cobrindo em vez disso o wiring URL→label→fetch, mesmo padrão dos testes existentes do `FilterBar`.
