# Design: Fato Gold Estrela Pura (`fac_auto_infracao`)

Data: 2026-09-24

## Contexto

Após a dimensão origem (spec `2026-09-24-dimensao-origem-design.md`), o fato gold
`fac_auto_infracao` permanece desnormalizado: joima dimensões e duplica rótulos
("Nome do Agente", "Origem", CASEs de apresentação) — enquanto
`fac_auto_infracao_mensal` já é estrela pura (só surrogate keys + medidas).

## Requisito aprovado

`gold.fac_auto_infracao` deve usar surrogate keys como o fato mensal: **estrela pura**,
com **todos os atributos** do fato silver. A API passa a joimar `gold.dim_*` em tempo
de query.

## Decisões

- Fato gold = `select * from silver fac_auto_infracao`: 8 `sk_*` (origem, agente,
  condutor, infracao, infrator, municipio, veiculo, erro_consistencia) + todos
  atributos do auto + `source_key`. Sem colunas de rótulo.
- CASEs de apresentação (Tipo Infração, Competência, Status do Auto, Turno, partes de
  data) migram do dbt para a API.
- Módulo novo na API (`apps/api/src/queries/goldStarExpressions.ts`) concentra os
  fragmentos SQL (FROM com joins + expressões de coluna) — fonte única usada por
  `autoInfracaoFilters.ts` e `autosInfracao.ts`.
- Aliases de saída da API não mudam (`agente`, `local`, `tipo`, `codigo`,
  `numero_auto`, `equipamento`, `periodo`, `competencia`, `motivo_cancelamento`,
  `status`) → web, exports e paginação inalterados.
- `fac_auto_infracao_mensal`: inalterado. Endpoint `/origens`: inalterado.

## 1. dbt gold

`dbt/nvdatalake/models/gold/fac_auto_infracao_gold.sql` vira:

```sql
{{ config(alias='fac_auto_infracao') }}

select *
from {{ ref('fac_auto_infracao') }}
```

## 2. API

- **`queries/goldStarExpressions.ts`** (novo): `GOLD_STAR_FROM`
  (`gold.fac_auto_infracao ai` + left joins `dim_agente`, `dim_infracao`,
  `dim_origem` por `sk_*`) e expressões: `AGENTE_EXPR` (`agente.nome`),
  `LOCAL_EXPR` (`ai.logradouro`), `TIPO_EXPR` (CASE `infracao.abordagem`),
  `CODIGO_EXPR` (`infracao.codigo::text`), `EQUIPAMENTO_EXPR`
  (`ai.android_serial`), `PERIODO_EXPR` (CASE hora), `DATA_HORA_EXPR`
  (`ai.data_hora`), `COMPETENCIA_EXPR` (CASE `infracao.competencia`),
  `STATUS_EXPR` (CASE `ai.status`), `MOTIVO_CANCELAMENTO_EXPR` (COALESCE das
  justificativas), `ORIGEM_EXPR` (`origem.nome`).
- **`queries/serieTemporal.ts`**: `bucketSqlExpression(granularity, column)` recebe a
  coluna (default `"Data e Hora"` mantido; rota passa `ai.data_hora`).
- **`queries/autoInfracaoFilters.ts`**: condições usam as expressões.
- **`routes/autosInfracao.ts`**: remove `VIEW`; todas as queries usam
  `FROM ${GOLD_STAR_FROM}`; `LIST_COLUMNS_SQL`, `GROUP_COLUMN_EXPR`,
  `SUGGESTION_FIELDS`, cláusula de cancelamento e queries de stats reescritas com as
  expressões; `ORDER BY ai.data_hora DESC NULLS LAST`.

## 3. Compatibilidade e deploy

- Web: zero mudanças (mesmos aliases de resposta).
- API nova + gold antigo: colunas de rótulo não existem mais → **ordem importa**:
  `dbt build` antes do deploy da API. API antiga + gold novo: quebra (colunas quoted
  somem) — deploy sequencial obrigatório.

## 4. Testes

- Filtros: cláusulas esperadas atualizadas (`agente.nome ILIKE $1`,
  `origem.nome = $1`, CASEs...).
- Rotas: asserções de SQL apontam para os novos fragmentos (FROM com joins, aliases).
- `serieTemporal.test.ts`: inalterado (default preservado) + caso com coluna custom.
- dbt: parse + build (fato gold recriado; downstream nenhum dentro do dbt).

## 5. README

Linha do Gold atualizada: fato `fac_auto_infracao` estrela pura com surrogate keys;
CASEs de apresentação na API.
