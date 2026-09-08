# NovaVia Data Lake (`nvdatalake`)

Plataforma de Engenharia de Dados (ELT / Data Lake) para ingestão, estruturação e transformação de dados de trânsito e infrações de trânsito.

---

## 🏛️ Arquitetura do Projeto

O projeto adota a **Medallion Architecture** (Bronze, Silver e Gold), separando a orquestração da ingestão das transformações analíticas:

```text
              [ Banco Origem: nvtr (schemas ce_caucaia_amostra, ce_quixada, ...) ]
                                            │
                                            ▼ (Dagster EL / SQLAlchemy)
                          [ Data Lake: nvdatalake (schema bronze) ]
                                            │
                                            ▼ (dbt Models)
                               ┌────────────┴────────────┐
                               ▼                         ▼
                    [ Schema: silver ]           [ Schema: gold ]
                    (Fatos e Dimensões)       (Agregados Analíticos)
```

### Tecnologias Utilizadas
- **[Dagster](https://dagster.io/)**: Orquestração do pipeline de dados (carga bronze e execução do dbt).
- **[dbt (data build tool)](https://www.getdbt.com/)**: Transformações SQL, tratamentos de dados e modelagem dimensional nas camadas Bronze, Silver e Gold.
- **[PostgreSQL](https://www.postgresql.org/)**: Banco de dados relacional para a origem (`nvtr`) e o Data Lake (`nvdatalake`).
- **[uv](https://docs.astral.sh/uv/)**: Gerenciador de pacotes e ambientes virtuais Python.

---

## 📁 Estrutura do Repositório

```text
novavia-datalake/
├── dagster/
│   └── nvdatalake/             # Projeto Dagster (Orquestração e Ingestão Bronze)
│       ├── src/nvdatalake/
│       │   ├── definitions.py  # Definição principal do Dagster (Assets & Recursos)
│       │   └── defs/
│       │       ├── assets.py   # Extração dos dados operacionais -> Bronze
│       │       ├── dbt_assets.py # Mapeamento dos modelos dbt no Dagster
│       │       └── dbt_project.py # Configuração da integração Dagster-dbt
│       ├── pyproject.toml
│       └── uv.lock
├── dbt/
│   └── nvdatalake/             # Projeto dbt (Transformações Silver & Gold)
│       ├── models/
│       │   ├── bronze/         # Staging e mapeamento de fontes (sources)
│       │   ├── silver/         # Tabelas Fato e Dimensão (dim_*, fac_*)
│       │   └── gold/           # Visões e agregados analíticos
│       ├── dbt_project.yml
│       └── macros/
└── README.md                   # Documentação principal do repositório
```

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Python 3.10+**
- **uv** instalado (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Instâncias **PostgreSQL** em execução para a origem (`nvtr`) e destino (`nvdatalake`).

---

### 1. Configurar o Ambiente Dagster

Acesse o diretório do Dagster e instale as dependências:

```bash
cd dagster/nvdatalake
uv sync
source .venv/bin/activate
```

---

### 2. Executar a Interface do Dagster

Inicie o servidor de desenvolvimento do Dagster:

```bash
dg dev
```

Acesse o painel em **http://localhost:3000** para visualizar a linhagem de assets e disparar os pipelines de ingestão e transformação.

---

### 3. Executar o dbt Diretamente (Opcional)

Caso queira rodar apenas os modelos do dbt via linha de comando:

```bash
cd dbt/nvdatalake
dbt build --profiles-dir ~/.dbt
```

---

## 🐳 Empacotamento com Docker

O projeto pode ser empacotado numa imagem única (Dagster + dbt embutido) pra rodar em outro servidor.

### Estrutura

- **[`Dockerfile`](Dockerfile)** — imagem baseada em `python:3.11-slim` + `uv`. Empacota `dagster/nvdatalake` (que já inclui `dbt-postgres`) junto com `dbt/nvdatalake` (os models), preservando a mesma estrutura relativa de pastas que o código espera. Roda `dbt parse` no build (gera `target/manifest.json` dentro da imagem — necessário porque em produção, via `dagster-webserver`, o Dagster não regenera esse manifest sozinho como faz em `dg dev`). Sobe `dagster-webserver` na porta `3000`.
- **[`.dockerignore`](.dockerignore)** — evita copiar `.venv`, `target/`, `logs/`, `__pycache__` etc para o contexto do build.
- **[`docker-compose.yml`](docker-compose.yml)** — dois serviços: `nvdatalake` (webserver, UI) e `nvdatalake-daemon` (`dagster-daemon run`, processa a fila de execução). **Sem o daemon, cliques de "Materialize" na UI não disparam o run.** Ambos compartilham o mesmo `DAGSTER_HOME` (volume `dagster_home`) e as mesmas env vars, via YAML anchor (`x-nvdatalake-env`).

Os bancos PostgreSQL (origem e destino) **não** são containerizados aqui — são instâncias externas já existentes, acessadas via variáveis de ambiente (ver seção [Destination database](dagster/nvdatalake/README.md#destination-database) e [Multi-source strategy](dagster/nvdatalake/README.md#multi-source-strategy)).

### Build da imagem

> Importante: o build precisa ser feito **a partir da raiz do repositório** (esta pasta), nunca de dentro de `dagster/nvdatalake` — o `Dockerfile` copia `dagster/nvdatalake` e `dbt/nvdatalake` como pastas irmãs, então o contexto do build tem que enxergar as duas.

```bash
docker build -t nvdatalake:latest .
```

### Verificar se os models dbt foram empacotados

Os models dbt (`bronze/`, `silver/`, `gold/`) e o `profiles.yml` viajam dentro da imagem — não é preciso montar volume nem copiar nada manualmente pro servidor. Pra conferir:

```bash
# lista os arquivos dbt dentro da imagem
docker run --rm nvdatalake:latest sh -c "ls -la /app/dbt/nvdatalake/models/bronze /app/dbt/nvdatalake/models/silver /app/dbt/nvdatalake/models/gold"

# confirma que o dbt consegue parsear o projeto empacotado (não precisa de conexão real com o banco)
docker run --rm -w /app/dagster/nvdatalake nvdatalake:latest \
  sh -c "uv run dbt parse --project-dir /app/dbt/nvdatalake --profiles-dir /app/dbt/nvdatalake"
```

### Rodar com docker compose

Credenciais não ficam mais no `docker-compose.yml` — ele lê via `${VAR}` de um `.env` na raiz.
Copia [`.env.example`](.env.example) pra `.env` e preenche com os valores reais (hosts, usuário,
senha, nome de cada banco). `.env` é gitignored, nunca commitar credenciais nele. Cada origem
usa seu próprio prefixo de env var, agrupado por `dbname` (`SOURCE_NVTR_DB_*` para o banco `nvtr`
— compartilhado entre todos os schemas desse banco; uma origem com `dbname` novo usa seu próprio
prefixo, ver [Adding a new source](dagster/nvdatalake/README.md#adding-a-new-source)), depois:

```bash
docker compose up -d --build
```

Acesse o painel do Dagster em **http://localhost:3000**. Confere que os dois serviços subiram:

```bash
docker compose logs --tail=30
```

### Rodar com docker run (sem compose)

Sem compose, sobem dois containers manualmente — um pro webserver, um pro daemon —, ambos com as mesmas env vars e o mesmo `DAGSTER_HOME` compartilhado (ex: um volume nomeado):

```bash
docker run -d --name nvdatalake -p 3000:3000 \
  -e SOURCE_NVTR_DB_HOST=host-origem -e SOURCE_NVTR_DB_PORT=5432 -e SOURCE_NVTR_DB_USER=usuario -e SOURCE_NVTR_DB_PASSWORD=senha -e SOURCE_NVTR_DB_NAME=nvtr \
  -e DATALAKE_DB_HOST=host-destino -e DATALAKE_DB_PORT=5432 -e DATALAKE_DB_USER=usuario -e DATALAKE_DB_PASSWORD=senha -e DATALAKE_DB_NAME=nvdatalake \
  -v dagster_home:/app/dagster_home \
  nvdatalake:latest

docker run -d --name nvdatalake-daemon \
  -e SOURCE_NVTR_DB_HOST=host-origem -e SOURCE_NVTR_DB_PORT=5432 -e SOURCE_NVTR_DB_USER=usuario -e SOURCE_NVTR_DB_PASSWORD=senha -e SOURCE_NVTR_DB_NAME=nvtr \
  -e DATALAKE_DB_HOST=host-destino -e DATALAKE_DB_PORT=5432 -e DATALAKE_DB_USER=usuario -e DATALAKE_DB_PASSWORD=senha -e DATALAKE_DB_NAME=nvdatalake \
  -v dagster_home:/app/dagster_home \
  nvdatalake:latest uv run dagster-daemon run
```

> `docker run` isolado (sem daemon) só serve pra rodar comandos avulsos, ex. `dagster asset materialize --select ... -m nvdatalake.definitions` — não pra manter a UI operacional com materialize funcionando.

### Rodar fora do Docker (local)

O script [`scripts/materialize_all.sh`](scripts/materialize_all.sh) roda a materialização
completa local: lê `.env` (se existir), aponta o dbt pro `profiles.yml` do projeto (sem isso o
dbt cai no `~/.dbt/profiles.yml` antigo com `localhost` fixo) e chama o `dagster asset
materialize --select '*'`:

```bash
./scripts/materialize_all.sh
```

Atenção: se o `.env` tiver hosts tipo `host.docker.internal` (só resolve dentro de container),
sobrescreve as vars de origem antes de rodar local, ex. `SOURCE_NVTR_DB_HOST=localhost`.

## 📊 Camadas de Dados

- **Bronze**: Dados brutos extraídos dos schemas de origem (atualmente `ce_caucaia_amostra` e `ce_quixada` do banco `nvtr` — tabelas: `auto_infracao`, `agente`, `infracao`, `municipio`, `pessoa`, `veiculo`, `erro_consistencia`). Ver [estratégia multi-origem](dagster/nvdatalake/README.md#multi-source-strategy).
- **Silver**: Modelos dimensionais higienizados e relacionados, com surrogate keys (`sk_*`) por dimensão (`dim_agente`, `dim_infracao`, `dim_municipio`, `dim_pessoa`, `dim_veiculo`, `dim_erro_consistencia`, `fac_auto_infracao`).
- **Gold**: Visões analíticas agregadas para relatórios e dashboards (ex: `fac_auto_infracao_mensal`).
