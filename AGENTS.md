# AGENTS.md

Orientações para agentes de código neste repositório. Para uso e execução, veja
[README.md](README.md) e [kestra/README.md](kestra/README.md).

Para comandos de shell, siga também [RTK.md](RTK.md) (proxy CLI que reduz o
consumo de tokens em operações de desenvolvimento).

Seja extremamente conciso ao reportar informações. Sacrifique a gramática em favor da concisão.

## Visão geral

Data Lake de infrações de trânsito. Dados de um PostgreSQL de origem (`nvtr`,
vários schemas regionais) são copiados para o PostgreSQL do Data Lake
(`nvdatalake`) e transformados em camadas Medallion. Uma API e um web expõem os
dados.

```text
nvtr (schemas regionais) --Kestra/ingest.py--> nvdatalake.bronze --dbt--> silver --> gold --> API --> Web
```

## Arquitetura

| Parte | Local | Papel |
| --- | --- | --- |
| Orquestração | `kestra/flows/materialize_all.yml` | Único fluxo: ingestão Bronze, `dbt build`, `dbt docs` |
| Ingestão (EL) | `kestra/ingest.py` | Copia tabelas das origens para `bronze.*` (Python, pandas, SQLAlchemy) |
| Transformação | `dbt/nvdatalake/` | Staging, Silver (dim/fato) e Gold (apresentação) |
| Auth e migrações | `db/migrations/` | SQL idempotente aplicado manualmente ao Data Lake |
| API | `apps/api/` | Express + TypeScript; auth JWT, consultas e exportações |
| Web | `apps/web/` | React + Vite |
| Infra | `docker-compose.yml`, `kestra/Dockerfile` | Kestra, metadados, import do fluxo, API e web |
| Testes E2E | `kestra/tests/`, `scripts/test_kestra.sh` | Pipeline real em Docker isolado, com dados sintéticos |

## Decisões de projeto (não reverter sem pedido explícito)

- **Kestra é o único orquestrador.** Dagster foi removido; não reintroduza
  referências a ele.
- **A lista de origens vive só no fluxo.** `variables.dbname`, `schemas` e
  `tables` em `materialize_all.yml` são a fonte única. `pluginDefaults` as
  repassa à ingestão e ao dbt como `NVDATALAKE_DBNAME`, `NVDATALAKE_SCHEMAS` e
  `NVDATALAKE_TABLES` (listas JSON). Não duplique essa lista em Python ou dbt.
- **Todos os schemas têm as mesmas tabelas.** Adicionar um schema é acrescentá-lo
  em `schemas`, mais o nome de exibição em `models/silver/dim_origem.sql`.
- **Tabelas opcionais** (`variables.optional_tables`, hoje `ait_retorno` e `codigo_retorno`) podem
  faltar em schemas. Ausência gera `WARNING` no log e em `skipped.json`, nunca
  erro (ingestão apaga a cópia Bronze antiga; `bronze_union(..., optional=true)`
  ignora o schema). Tabelas de `tables` continuam obrigatórias e falham o fluxo.
- **Bronze:** tabela `bronze.<dbname>_<schema>__<tabela>` (ex.:
  `nvtr_sc_pomerode__agente`). A carga é *full-replace* por tabela, em transação,
  preservando os tipos PostgreSQL da origem.
- **Schema drift é tolerado no dbt**, pela macro `bronze_union`: une os schemas
  de uma tabela, preenche com `null` (com o tipo correto) as colunas ausentes e
  adiciona `source_key`. Os `stg_*` são só `{{ bronze_union('<tabela>') }}`.
  Não há `_sources.yml`.
- **Conexões de origem:** `SOURCE_<DBNAME>_DB_*` (ou `SOURCE_<DBNAME>_DB_URL`),
  agrupadas por `dbname`, não por schema. Destino: `DATALAKE_DB_*`.
- **Silver:** dimensões com surrogate keys `sk_*`; chave `0` representa membro
  desconhecido (`coalesce(sk, 0)` no fato). `dim_municipio` deduplica por código
  IBGE, priorizando a menor `source_key`. `dim_origem` deriva de `source_key`.
- **Retorno de AIT:** `fac_ait_retorno` (Silver/Gold) liga `stg_ait_retorno` a
  `dim_codigo_retorno` por `(source_key, codigo_retorno = id)`, como o FK real da
  origem; sem correspondência, `sk_codigo_retorno = 0`. `num_auto` fica como
  atributo (sem FK para o auto).
- **`sk_auto`:** sequência simples (`row_number`) em `dim_auto`, com business key
  `source_key` + `num_auto` (com `trim`; vazio vira nulo e fica fora). Linha `0` =
  auto desconhecido. `fac_auto_infracao` e `fac_ait_retorno` ligam-se por `sk_auto`;
  a unicidade `(source_key, num_auto)` é testada só em `dim_auto`. Em
  `fac_ait_retorno` `num_auto` **repete** (um auto pode ser processado mais de uma
  vez; ex.: até 5 retornos por auto); a chave do fato é `(source_key, id)`.
  Retorno sem auto vai para `0`.
- **`num_dias`:** métrica em `fac_auto_infracao` e `fac_ait_retorno` (Silver/Gold) =
  dias entre `data_hora` do auto e a data da execução do dbt (`America/Sao_Paulo`).
  Em `fac_ait_retorno` vem do auto ligado por `sk_auto`; retorno órfão fica nulo.
  Não use testes dbt `severity: warn`: o fluxo termina `WARNING` e a CLI trata como falha.
- **Parâmetros:** `config.parametro` (chave/valor; PK `(source_key, chave)`,
  `atualizado_em`) vive no schema `config`, criado pela migração manual
  `003_config_parametros.sql`, fora do pipeline (bronze/silver/gold são
  recriados). `source_key` é a origem (`nvtr_sc_pomerode`) ou `'*'` (todas; o valor
  da origem sobrescreve). Chaves (validadas por CHECK): `data_inicial_padrao`
  (só `'*'`), `data_inicial_autos`, `tipo_envio_processamento`,
  `receptor_processamento`, `num_dias_retencao_processamento`. O dbt pivota em
  `dim_parametro_origem` (1 linha por origem; sem valor = nulo). Aplique a 003
  **antes** do fluxo; sem ela a ingestão (e o dbt, em `dim_parametro_origem`) falha. Compare `num_dias` dos fatos com
  `num_dias_retencao_processamento`.
- **Data inicial dos autos:** a ingestão só lê `auto_infracao` com
  `data_hora >= data inicial` e `ait_retorno` cujo auto (`num_auto` com `trim`)
  está nessa faixa (retorno órfão não é ingerido; auto com `data_hora` nulo
  também fica fora). Data = `data_inicial_autos` da origem, senão
  `data_inicial_padrao` (`'*'`, semeada com `2026-01-01` pela migração). Sem a
  tabela ou sem data, a ingestão falha (nunca carrega tudo). Full-replace:
  mudar a data exige reexecutar o fluxo.
- **Dashboard Processamento** (`/processamento`, `GET /api/processamento/stats`,
  permissão `dashboard.read`): universo = `gold.fac_auto_infracao` com `num_dias >= 1`
  (0 = auto de hoje, fora). Prazo N = `num_dias_retencao_processamento` da origem (sem N, o auto
  fica fora). Dentro do prazo = `num_dias <= N`. O gráfico de faixas
  ("Autos de Infração não Processados") mostra só autos com `status_arquivamento` diferente de
  `PROCESSADO_SUCESSO` (nulo conta como não processado); KPIs: "Total de Autos" (todos do universo), "Autos processados" (`PROCESSADO_SUCESSO`) e dentro/fora do prazo (só não processados).
  Faixas: diárias 1..N, de 5 em 5 até 30, `>30`.
- **Gold:** camada autocontida. Dimensões espelhadas (`*_gold`) e fatos estrela
  (`fac_auto_infracao`, `fac_ait_retorno`, `fac_auto_infracao_mensal`). Rótulos e CASEs de
  apresentação ficam na API, não no dbt.
- **`generate_schema_name` customizado:** o schema do `custom_schema_name` é usado
  literalmente (`bronze`, `silver`, `gold`), sem prefixo do target.
- **Falha interrompe o fluxo**; reexecute o fluxo completo. Há no máximo uma
  execução por vez (`concurrency.limit: 1`). O cron `daily` fica desabilitado
  por padrão.
- **Auth própria** na API: e-mail e senha (Argon2id), access JWT em memória no
  web, refresh token rotacionado em cookie `HttpOnly`. Permissões:
  `dashboard.read`, `autos.read`, `autos.export`, `users.read`, `users.manage`,
  `roles.manage`. Migrações e criação do admin são manuais; o Compose não as roda.
- **Compose serve só HTTP** (sem gateway HTTPS); bancos de origem e destino são
  externos.

## Comandos úteis

```bash
# Pipeline completo (Docker)
docker compose up -d --build kestra kestra-import

# Executar o fluxo pela CLI (requer KESTRA_API_USER / KESTRA_API_PASSWORD)
python3 scripts/kestra.py run [--full-refresh]

# Validação ponta a ponta em bancos isolados (portas 18082 e 55440)
./scripts/test_kestra.sh

# API e web
cd apps/api && npm run dev
cd apps/web && npm run dev
```

O dbt depende das variáveis `NVDATALAKE_*`, então rode-o pelo fluxo Kestra, não
isoladamente.

## Convenções para mudanças

- Mudou o conjunto de origens, tabelas ou modelos? Atualize: o fluxo, `dim_origem.sql`,
  `kestra/tests/` (fixtures e asserções, incluindo o inventário de 34 modelos) e
  os READMEs (contagens de schemas, tabelas e modelos).
- Novo modelo dbt: adicione testes em `_quality.yml` ou `tests/`; eles rodam no
  `dbt build` do fluxo.
- Valide com `./scripts/test_kestra.sh` antes de concluir mudanças em ingestão ou dbt.
  Ele prova o funcionamento só com dados sintéticos; execuções nas bases reais
  dependem do ambiente (veja `kestra/VALIDATION.md`).
- Nunca commite `.env`, credenciais ou segredos; use `.env.example`.
- Mantenha a documentação em português, como o restante do repositório.
- Faça mudanças cirúrgicas: não refatore código adjacente nem reformate arquivos.
