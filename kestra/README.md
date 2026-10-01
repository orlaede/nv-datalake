# Kestra + dbt

O Kestra executa o pipeline completo como orquestrador padrão: as 14 tabelas
de `SOURCES` são copiadas para Bronze, depois o projeto dbt inteiro é executado
com `dbt build` (24 modelos e todos os testes). O projeto dbt, `profiles.yml`,
macros, aliases, schemas, paths e dependências são os mesmos do Dagster.

## Iniciar

Na raiz do repositório, configure `.env` a partir de `.env.example` com as
conexões existentes e as variáveis `KESTRA_*`. Escolha senhas próprias para
`KESTRA_DB_PASSWORD` e `KESTRA_API_PASSWORD` (mínimo 8 caracteres, com letra
maiúscula e número), e um e-mail para `KESTRA_API_USER`.

```bash
docker compose up -d --build kestra kestra-import
docker compose logs kestra-import
```

O serviço `kestra-import` aguarda o healthcheck e valida/importa o fluxo
versionado. Ele deve terminar com código 0. A importação atualiza um fluxo
existente, sem apagar o histórico. Execute o mesmo comando após alterações
nos modelos, código ou fluxo para reconstruir a imagem e atualizar a definição.

Acesse **http://localhost:8082** e entre com `KESTRA_API_USER` e
`KESTRA_API_PASSWORD`. No namespace `nvdatalake`, execute `materialize_all`.
Para acesso a um servidor remoto, use túnel SSH:

```bash
ssh -L 8082:127.0.0.1:8082 usuario@servidor
```

O Compose inicia Kestra e dbt sem serviços Dagster. O código Python de ingestão
e o ambiente de dependências continuam em `dagster/nvdatalake`, compartilhados
com o código legado. O PostgreSQL
`kestra-postgres` guarda somente metadados do orquestrador; origem e Data Lake
continuam sendo as conexões externas configuradas por `SOURCE_NVTR_DB_*` e
`DATALAKE_DB_*`. `PGSSLMODE` é aplicado à ingestão e ao dbt. Dentro de contêineres,
use `host.docker.internal` para bancos no host, em vez de `localhost`.

## Fluxo e artefatos

1. `ingest_bronze`: usa a mesma função de carga do Dagster, preservando tipos
   PostgreSQL, e salva `ingestion.json` com a contagem das 14 tabelas.
2. `prepare_dbt`: copia o projeto para um diretório exclusivo da execução,
   instala dependências de `packages.yml` quando existirem e roda `dbt debug`.
3. `build_dbt`: executa `dbt build`, incluindo todos os modelos, testes,
   seeds e snapshots habilitados no projeto; `full_refresh=true` adiciona
   `--full-refresh`. Salva `manifest.json` e `run_results.json`.
4. `docs_dbt`: gera e salva `catalog.json` e `index.html` da documentação dbt.

Os arquivos ficam em **Outputs** das tarefas na execução Kestra. Os volumes
`kestra_postgres` e `kestra_storage` persistem o histórico e os artefatos. As
dependências Python são instaladas do `dagster/nvdatalake/uv.lock`, com dbt-core
1.11.14 e dbt-postgres 1.11.0; a imagem Kestra é fixada em `v1.3.41`.
O worker executa como usuário `kestra` com Process runner; não monta Docker socket.

Uma falha interrompe as próximas tarefas. A carga Bronze é full-replace por
tabela, em transação: uma falha preserva a versão anterior daquela tabela, mas
tabelas já concluídas permanecem atualizadas. Reexecute o fluxo completo após
corrigir a causa. Há no máximo uma execução deste fluxo por vez.

## CLI

O cliente usa somente a biblioteca padrão do Python. Exporte as credenciais
configuradas no `.env` antes de usá-lo:

```bash
export KESTRA_API_USER='seu-email'
read -rs KESTRA_API_PASSWORD
export KESTRA_API_PASSWORD
python3 scripts/kestra.py validate
python3 scripts/kestra.py import
python3 scripts/kestra.py run --full-refresh
```

`--url` altera o endereço (padrão `http://localhost:8082`); `--timeout` altera o
limite de espera (padrão 1800 segundos). A CLI retorna erro quando a execução
falha, é cancelada, é morta, termina com warning ou excede o timeout.

## Agendamento

O cron é `0 3 * * *`, timezone `America/Sao_Paulo`.
Começa **desabilitado**. Para usar Kestra diariamente, habilite o trigger `daily`.
Para persistir a escolha no Git, mude `disabled: false` no flow e importe-o.
Há no máximo uma execução deste fluxo por vez.

## Testar tudo

Com Docker e uv instalados, na raiz:

```bash
./scripts/test_kestra.sh
```

O script constrói a imagem, sobe Kestra e PostgreSQL isolados, testa o fluxo
real via API, executa a suíte Dagster existente e remove a infraestrutura de
teste ao terminar. Não lê `.env` nem usa os bancos reais. Reserva as portas
`18082` e `55440` e o projeto Compose `nv-kestra-e2e` para esse teste.

A suíte verifica preservação de tipos de todas as tabelas de origem, inteiros
nullable, URLs com senha especial, staging, schema drift, IDs iguais entre
origens, dimensão desconhecida com chave 0, municípios deduplicados,
espelhamento Silver/Gold, agregados mensais, inventário dos 24 modelos,
artefatos, repetição sem duplicação, falha de ingestão e falha de teste dbt.
Os testes de chaves, contagem, relacionamentos e paridade adicionados ao
próprio projeto dbt são executados por ambos os orquestradores.

A validação também cobre versões divergentes do mesmo município entre origens.
`dim_municipio` escolhe uma linha por código IBGE, priorizando a menor
`source_key`, para impedir que diferenças de descrição ou versão multipliquem
os fatos. Uma mudança nesse modelo exige reconstruir seus dependentes para
aplicar a correção aos dados já materializados.

Essa validação prova funcionamento na infraestrutura isolada com dados
sintéticos. Execuções nas bases reais dependem das conexões, permissões,
certificados e qualidade dos dados desse ambiente.
Veja as evidências e a reconstrução real pendente em [VALIDATION.md](VALIDATION.md).

## Diagnóstico

```bash
docker compose ps -a
docker compose logs --tail=100 kestra kestra-import kestra-postgres
```

Em Mac M4, se o Java falhar com `SIGILL`, configure
`KESTRA_JAVA_OPTS=-Xms256m -Xmx1g -XX:UseSVE=0` e recrie o serviço.

Referências: [Kestra com PostgreSQL](https://kestra.io/docs/installation/docker-compose),
[plugin dbt CLI](https://kestra.io/plugins/plugin-dbt/dbt-cli/io.kestra.plugin.dbt.cli.dbtcli),
[API](https://kestra.io/docs/how-to-guides/api).
