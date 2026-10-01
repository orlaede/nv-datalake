# Data Lake (`nvdatalake`)

Plataforma de Engenharia de Dados (ELT / Data Lake) para ingestão, estruturação e transformação de dados de trânsito e infrações de trânsito.

---

## 🏛️ Arquitetura do Projeto

O projeto adota a **Medallion Architecture** (Bronze, Silver e Gold), separando a orquestração da ingestão das transformações analíticas:

```text
              [ Banco Origem: nvtr (schemas ce_caucaia_amostra, ce_quixada, ...) ]
                                            │
                                            ▼ (Kestra EL / SQLAlchemy)
                          [ Data Lake: nvdatalake (schema bronze) ]
                                            │
                                            ▼ (dbt Models)
                               ┌────────────┴────────────┐
                               ▼                         ▼
                    [ Schema: silver ]           [ Schema: gold ]
                    (Fatos e Dimensões)       (Agregados Analíticos)
```

### Tecnologias Utilizadas
- **[Kestra](https://kestra.io/)**: Orquestrador do pipeline completo de ingestão e dbt, com fluxo versionado, artefatos persistentes e testes de ponta a ponta. Veja [configuração e execução](kestra/README.md).
- **[dbt (data build tool)](https://www.getdbt.com/)**: Transformações SQL, tratamentos de dados e modelagem dimensional nas camadas Bronze, Silver e Gold.
- **[PostgreSQL](https://www.postgresql.org/)**: Banco de dados relacional para a origem (`nvtr`) e o Data Lake (`nvdatalake`).
- **[uv](https://docs.astral.sh/uv/)**: Gerenciador de pacotes e ambientes virtuais Python.
- **[React](https://react.dev/) + [Vite](https://vite.dev/)**: Aplicação web para dashboards e consultas de infrações.
- **[Express](https://expressjs.com/)**: API HTTP que fornece os dados consumidos pela aplicação web.

---

## 📁 Estrutura do Repositório

```text
nv-datalake/
├── apps/
│   ├── api/                    # API HTTP (Express) para consultas e exportações
│   └── web/                    # Aplicação web (React + Vite) para dashboards e listagens
├── dagster/
│   └── nvdatalake/             # Código legado e ambiente Python de ingestão
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

As aplicações em `apps/` são a camada de acesso e visualização dos dados processados
no Data Lake: a API expõe consultas e exportações, enquanto o web disponibiliza os
dashboards e as listagens para os usuários.

### Executar as aplicações localmente

As aplicações possuem seus próprios `package.json` e são executadas separadamente.
É necessário ter **Node.js** e **npm** instalados.

#### API

```bash
cd apps/api
npm install
cp .env.example .env
npm run dev
```

A API inicia, por padrão, em **http://localhost:3001**.

#### Web

Em outro terminal:

```bash
cd apps/web
npm install
cp .env.example .env
npm run dev
```

A aplicação web usa `VITE_API_URL` para localizar a API — em desenvolvimento,
por padrão, `http://localhost:3001` — e fica disponível no endereço exibido
pelo Vite. Em produção, quando web e API usam o mesmo domínio por reverse
proxy, deixe `VITE_API_URL` vazio para que o web use URLs relativas.

### Controle de acesso

A API usa autenticação própria por e-mail e senha, com senha armazenada em
Argon2id. O access token JWT fica em memória no web e o refresh token é
rotacionado em cookie `HttpOnly`. Em produção, configure um segredo JWT com no
mínimo 32 caracteres, `AUTH_COOKIE_SECURE=true` e `AUTH_ALLOWED_ORIGIN` com a
origem pública do web.

Aplique as migrações no Data Lake, nesta ordem (elas são idempotentes):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f db/migrations/001_auth_schema.sql \
  -f db/migrations/002_auth_seed.sql
```

Se `DATABASE_URL` não for usado, monte a conexão com as variáveis
`DATALAKE_DB_HOST`, `DATALAKE_DB_PORT`, `DATALAKE_DB_USER`, `DATALAKE_DB_PASSWORD`
e `DATALAKE_DB_NAME`. Depois crie o primeiro administrador de forma interativa:

```bash
cd apps/api
npm run create-admin
```

O comando é idempotente para o mesmo e-mail e não imprime a senha. A
administração está disponível pela API em `/api/admin/users`,
`/api/admin/roles` e `/api/admin/permissions`.

| Permissão | Responsabilidade |
| --- | --- |
| `dashboard.read` | Visualizar indicadores |
| `autos.read` | Consultar autos e agrupamentos |
| `autos.export` | Exportar Excel e PDF |
| `users.read` | Listar usuários |
| `users.manage` | Criar, editar, ativar, desativar e revogar sessões |
| `roles.manage` | Administrar roles e permissões atribuídas |

As rotas de autos exigem `autos.read`; as exportações também exigem
`autos.export`. O endpoint `/health` e os endpoints de login, refresh e logout
permanecem públicos.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos

- Docker com Compose para Kestra e dbt.
- PostgreSQL de origem (`nvtr`) e destino (`nvdatalake`) acessíveis.
- Python 3.11 e uv para executar a suíte de testes localmente.

### Executar com Kestra

Configure as conexões e `KESTRA_*` no `.env` da raiz, depois:

```bash
docker compose up -d --build kestra kestra-import
```

Acesse **http://localhost:8082**, faça login e execute
`nvdatalake.materialize_all`. O fluxo contempla as 14 tabelas de origem, todos
os 24 modelos dbt e seus testes. O cron diário começa desabilitado; habilite o trigger `daily` para agendar as cargas. Para verificar a integração completa em
bancos isolados, execute `./scripts/test_kestra.sh`. Mais detalhes em
[kestra/README.md](kestra/README.md).

---

## 🐳 Empacotamento com Docker

O Compose usa Kestra com dbt embutido na imagem definida em
[`kestra/Dockerfile`](kestra/Dockerfile). Os serviços são `kestra`,
`kestra-postgres` (metadados), `kestra-import` (importação do fluxo), `api`,
`web` e `gateway`. O dbt é executado pelo Kestra, sem serviço separado.
Os bancos de origem e destino continuam externos.

Configure [`.env.example`](.env.example) em `.env`, incluindo conexões,
`KESTRA_*` e `AUTH_JWT_SECRET`, depois execute:

```bash
docker compose up -d --build
```

Para iniciar somente a orquestração:

```bash
docker compose up -d --build kestra kestra-import
```

O web usa `/api/` pela rede interna. Para acesso local, mantenha
`AUTH_COOKIE_SECURE=false` e ajuste `AUTH_ALLOWED_ORIGIN` ao endereço do web.
As migrações e a criação do administrador seguem os passos de **Controle de acesso**;
o Compose não as executa automaticamente. Para bancos no host Docker Desktop,
use `host.docker.internal` em vez de `localhost` nas conexões dos contêineres.

Endereços padrão:

- Web: **http://localhost:8080** (`WEB_PORT`).
- API: **http://localhost:3001/health** (`API_PORT`).
- Kestra: **http://localhost:8082** (`KESTRA_PORT`, somente loopback).
- Web HTTPS: **https://<host>:8443** (`TLS_PORT`).
- Kestra HTTPS: **https://<host>:8444** (`KESTRA_TLS_PORT`), com login do Kestra.

O gateway Caddy usa `tls internal` e persiste sua autoridade no volume
`caddy_data`. Para confiar no certificado, extraia a CA e instale-a no cliente:

```bash
docker compose exec gateway cat /data/caddy/pki/authorities/local/root.crt > cert.pem
```

Em produção, configure `AUTH_COOKIE_SECURE=true` e a origem HTTPS em
`AUTH_ALLOWED_ORIGIN`. Para certificado público, configure um domínio próprio
no [`apps/gateway/Caddyfile`](apps/gateway/Caddyfile).

```bash
docker compose ps -a
docker compose logs --tail=30
```

O código legado Dagster permanece no repositório, mas seus serviços e o volume
`dagster_home` não fazem parte do Compose. Remova os contêineres antigos sem
apagar volumes, caso ainda existam:

```bash
docker rm -f nv-datalake-nvdatalake-1 nv-datalake-nvdatalake-daemon-1
```

## 📊 Camadas de Dados

- **Bronze**: Dados brutos extraídos dos schemas de origem (atualmente `ce_caucaia_amostra` e `ce_quixada` do banco `nvtr` — tabelas: `auto_infracao`, `agente`, `infracao`, `municipio`, `pessoa`, `veiculo`, `erro_consistencia`). Ver [estratégia multi-origem](dagster/nvdatalake/README.md#multi-source-strategy).
- **Silver**: Modelos dimensionais higienizados e relacionados, com surrogate keys (`sk_*`) por dimensão (`dim_agente`, `dim_infracao`, `dim_municipio`, `dim_pessoa`, `dim_veiculo`, `dim_erro_consistencia`, `dim_origem`, `fac_auto_infracao`).
- **Gold**: Camada de apresentação autocontida: dimensões espelhadas em `gold.*` (incluindo `dim_origem`, derivada do `source_key`) e fatos estrela pura com surrogate keys (`fac_auto_infracao` com as 8 `sk_*` + atributos do auto, `fac_auto_infracao_mensal` com `sk_origem`). Os rótulos e CASEs de apresentação são montados pela API ao joimar as dimensões.
