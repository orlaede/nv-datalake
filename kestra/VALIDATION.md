# Evidências de validação — 2026-10-01

Branch: `codex/integracao-kestra`, baseada em `main` (`51aa10e`).

## Pipeline isolado

Comando: `./scripts/test_kestra.sh`.

- Build da imagem Kestra 1.3.41 concluído.
- 18 testes Kestra aprovados e 5 testes Dagster existentes aprovados.
- Fluxo real executado via API com 14 tabelas de origem, 24 modelos dbt e
  todos os 76 testes dbt aprovados. Manifest e catálogo conferidos contra
  o inventário completo do projeto.
- Perfis, schemas, materialização em tabelas, tipos PostgreSQL, schema drift,
  resolução de dimensões, chaves desconhecidas, paridade Silver/Gold e
  totais mensais verificados.
- Reexecução idempotente, histórico e artefatos após reinício verificados.
- Falhas intencionais de ingestão e qualidade dbt interromperam o fluxo.
- Execução final restaurada após os testes de falha:
  `wkVEpAq8wMi0osuRdie7X`, estado `SUCCESS`.
- Infraestrutura e volumes de teste removidos ao terminar. `.env` e URLs
  externas herdadas não são usados pela suíte.

## Ambiente configurado no projeto

- Kestra atualizado e saudável em `http://localhost:8082`.
- Fluxo `nvdatalake.materialize_all` importado, revisão 1; validação sem
  restrições, warnings ou depreciações. Cron diário desabilitado.
- Conexões de origem e destino verificadas; as 14 tabelas de origem existem.
- `dbt debug` aprovado.
- `dbt test` nas tabelas existentes, com
  `PGOPTIONS='-c default_transaction_read_only=on'`: **74 aprovados, 2 falhas**.
  `unique_dim_municipio_codigo` encontrou 1 código repetido;
  `unique_key_fac_auto_infracao_source_key__id` encontrou 230 chaves repetidas.

O modelo anterior de município agrupava também descrição e versão. Variantes
do mesmo código IBGE entre origens multiplicavam os fatos no join. A branch
corrige `dim_municipio` para escolher uma linha por código, priorizando
`source_key`. O problema foi reproduzido na fixture: a suíte falhou antes da
correção e passou depois, incluindo asserção da linha canônica e dos totais.

## Validação real pendente

A correção no SQL ainda não foi aplicada às tabelas reais materializadas.
A execução completa com `--full-refresh` foi bloqueada pela revisão automática
de aprovação porque substitui as tabelas Bronze/Silver/Gold. É necessária
autorização explícita para essa reconstrução. Nenhuma carga real foi executada
nesta validação, e as bases de origem não foram modificadas.

Após autorização, executar o fluxo completo, conferir `SUCCESS` e verificar
os artefatos `ingestion.json`, `manifest.json`, `run_results.json` e
`catalog.json`. Só então será possível confirmar a aprovação dos 76 testes
sobre os dados reais reconstruídos.
