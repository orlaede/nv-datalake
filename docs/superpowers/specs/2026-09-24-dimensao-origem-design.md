# Design: Dimensão Origem (source_key) + Filtro de Origem na Interface

Data: 2026-09-24

## Contexto

Os dados do dashboard vêm de origens diferentes, identificadas pelo campo `source_key`
(hardcoded nos models `stg_*` do bronze: `nvtr_ce_caucaia_amostra` e `nvtr_ce_quixada`).
Hoje o `source_key` existe apenas no schema silver — o gold não o expõe e a interface
não permite filtrar por origem.

## Requisitos

1. Origem deve ser uma nova dimensão no schema silver.
2. Todas as dimensões devem também existir no schema gold.
3. Os fatos do gold devem referenciar a dimensão origem (conteúdo do `source_key`).
4. Filtro geral na interface para selecionar a origem, com opção "Todas as origens"
   (sem filtro), posicionado antes dos filtros de datas.

## Decisões aprovadas

- Espelhar **todas** as dimensões no gold (camada de apresentação autocontida, padrão Kimball).
- Espelhos materializados como **tabelas físicas** (padrão gold do projeto).
- Vínculo fato↔origem via **surrogate key `sk_origem`** (padrão `sk_*` existente).
- Filtro exibe **nomes amigáveis** ("Caucaia (Amostra)", "Quixadá").

## 1. dbt Silver — `dim_origem` + fato

**Novo model `dbt/nvdatalake/models/silver/dim_origem.sql`** (tabela):

```sql
select
    row_number() over (order by source_key) as sk_origem,
    source_key,
    case source_key
        when 'nvtr_ce_caucaia_amostra' then 'Caucaia (Amostra)'
        when 'nvtr_ce_quixada' then 'Quixadá'
        else source_key
    end as nome
from (select distinct source_key from {{ ref('stg_auto_infracao') }})
```

Origem nova futura aparece automaticamente na dim (rótulo = `source_key` até o CASE
ser atualizado).

**`models/silver/fac_auto_infracao.sql`**: adiciona
`coalesce(origem.sk_origem, 0) as sk_origem` via left join de `dim_origem` por
`source_key`. Mantém a coluna `source_key` (os joins das demais dimensões continuam
usando-a).

## 2. dbt Gold — dimensões espelhadas + fatos

**7 novos models**, seguindo o padrão existente (`fac_auto_infracao_gold.sql` com
`config(alias=...)`, pois nomes de model dbt são únicos no projeto):

| Model (arquivo)         | Alias             | Conteúdo                                   |
| ----------------------- | ----------------- | ------------------------------------------ |
| `dim_agente_gold.sql`   | `dim_agente`      | `select * from {{ ref('dim_agente') }}`    |
| `dim_infracao_gold.sql` | `dim_infracao`    | idem                                       |
| `dim_municipio_gold.sql`| `dim_municipio`   | idem                                       |
| `dim_pessoa_gold.sql`   | `dim_pessoa`      | idem                                       |
| `dim_veiculo_gold.sql`  | `dim_veiculo`     | idem                                       |
| `dim_erro_consistencia_gold.sql` | `dim_erro_consistencia` | idem                       |
| `dim_origem_gold.sql`   | `dim_origem`      | idem                                       |

Todas materializadas como tabela (default gold em `dbt_project.yml`). O `ref()` aponta
para o model silver; o `alias` cria a relação em `gold.*`.

**`fac_auto_infracao_gold.sql`**: joins trocados para as dims gold e nova coluna
`"Origem"` (rótulo amigável via join de `sk_origem` com `gold.dim_origem`).

**`fac_auto_infracao_mensal.sql`**: adiciona `sk_origem` ao select e ao group by.

Gold fica autocontido: fatos joiram somente dims gold.

## 3. API (Express)

- `apps/api/src/queries/autoInfracaoFilters.ts`: novo filtro `origem?: string` com
  condição `"Origem" = $n`. Por usar `buildAutoInfracaoWhere`, aplica-se automaticamente
  a todos os endpoints (`/api/autos-infracao`, `/groups`, `/group-rows`, `/stats`,
  `/export`, `/export-pdf`, `/suggestions`).
- Novo endpoint `GET /api/autos-infracao/origens`:
  `SELECT nome FROM gold.dim_origem ORDER BY nome` — popula o select da UI. Mesma
  postura de autenticação dos demais endpoints de leitura de autos.

## 4. Web (React)

- `apps/web/src/lib/use-filters.ts`: `"origem"` entra em `FILTER_KEYS` (parâmetro de
  URL; o botão "Limpar" do drawer já o cobre).
- `apps/web/src/components/dashboard/FiltersControls.tsx`: novo `OrigemSelector`
  (select shadcn/ui, altura `h-8`, mesmo estilo do `PeriodSelector`), posicionado
  **antes** do `PeriodSelector`:
  - Opção default: **"Todas as origens"** (valor vazio → remove o parâmetro → sem filtro).
  - Demais opções: `GET /api/autos-infracao/origens` via react-query.
  - Aparece no Dashboard e na Listagem (ambos usam `FiltersControls`).
- `origem` flui automaticamente nas chamadas (`apiGet` serializa os filtros na query).

## 5. Testes e verificação

- **API**: casos com `origem` em `autoInfracaoFilters.test.ts` e `autosInfracao.test.ts`
  (`npm test` em `apps/api`).
- **Web**: teste do `OrigemSelector` (default "Todas as origens"; seleção atualiza o
  parâmetro de URL) (`npm test` em `apps/web`).
- **dbt**: `dbt build` materializa tudo; teste `unique` em `dim_origem.source_key`.

## Fluxo de dados

```
bronze (source_key hardcode) → stg_* → dim_origem (silver) ──espelho──→ gold.dim_origem
                                            │                              ↑
                                            ▼                              │ sk_origem
                              fac_auto_infracao (silver, +sk_origem) ──→ fac_auto_infracao (gold, +"Origem")
                                                                           │
                                                    API (filtro ?origem=) ─┘ → UI (select "Origem" antes das datas)
```

## Tratamento de erros / degradação

- `origem` desconhecido na API → zero linhas (comportamento SQL normal de filtro).
- Falha ao buscar origens na UI → select exibe apenas "Todas as origens" (degrada
  graciosamente).

## Ordem de implantação

1. `dbt build` (novas dims gold + colunas novas; retrocompatível com API/web atuais).
2. Deploy da API (novo filtro + endpoint de origens).
3. Deploy do web (novo filtro na interface).
