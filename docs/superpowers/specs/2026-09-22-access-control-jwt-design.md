# Controle de acesso com JWT — especificação

## Objetivo

Adicionar autenticação própria por e-mail e senha, autorização por roles e permissões funcionais, telas administrativas e proteção das rotas da aplicação web/API.

## Decisões aprovadas

- A identidade será gerenciada pela própria aplicação.
- O login usará e-mail e senha; a senha será armazenada somente como hash Argon2id.
- Web e API ficarão sob o mesmo domínio em produção.
- A autenticação usará JWT.
- O access token terá vida curta, recomendadamente 15 minutos.
- O refresh token será persistido somente como hash no PostgreSQL e enviado em cookie `HttpOnly`, `Secure` e `SameSite=Lax`.
- O access token ficará apenas em memória no navegador; nunca será salvo em `localStorage`.
- O controle será por funcionalidades, sem filtragem por órgão, município ou região nesta fase.
- Haverá telas administrativas para usuários e roles.
- Não haverá cadastro público; o primeiro administrador será criado por comando operacional.

## Arquitetura

### PostgreSQL

As tabelas de identidade ficarão em um schema separado chamado `auth`, sem alterar a estrutura dos schemas `bronze`, `silver` ou `gold`.

Tabelas:

- `auth.users`: usuário, e-mail normalizado, nome, `password_hash`, ativo/inativo, datas de criação/alteração, último login e controle de senha.
- `auth.roles`: roles cadastradas, com chave única, nome, descrição e status.
- `auth.permissions`: catálogo versionado de permissões funcionais.
- `auth.user_roles`: associação entre usuários e roles.
- `auth.role_permissions`: associação entre roles e permissões.
- `auth.refresh_tokens`: hash do token, usuário, expiração, revogação, rotação, IP e user-agent.
- `auth.audit_events`: eventos de login, logout, alterações de usuário, alterações de role e troca de senha.

Todas as tabelas terão chaves primárias, `NOT NULL` onde aplicável, índices para e-mail, hashes, chaves estrangeiras e expiração. Datas usarão `TIMESTAMPTZ` e identificadores usarão UUID ou identity conforme a necessidade do registro. A criação será feita por migrations SQL versionadas e executadas explicitamente contra o PostgreSQL.

Roles iniciais recomendadas:

- `admin`: administração completa e acesso ao painel.
- `operador`: consulta do dashboard/listagem e exportações autorizadas.
- `consulta`: somente consulta do dashboard/listagem.

Permissões iniciais:

- `dashboard.read`
- `autos.read`
- `autos.export`
- `users.read`
- `users.manage`
- `roles.manage`

O catálogo de permissões será controlado por migration. Roles poderão ser administradas pela tela, mas a API continuará sendo a autoridade para autorização.

### API

Endpoints públicos:

- `GET /health`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

Endpoint autenticado:

- `GET /api/auth/me`

Administração:

- `GET/POST /api/admin/users`
- `GET/PATCH /api/admin/users/:id`
- `POST /api/admin/users/:id/roles`
- `POST /api/admin/users/:id/revoke-sessions`
- `GET/POST/PATCH /api/admin/roles`
- `GET /api/admin/permissions`

O login verifica o hash da senha, registra o evento, cria o refresh token e retorna um access token JWT. O refresh valida o hash persistido, revoga o token usado, cria um novo refresh token e retorna um novo access token. Logout revoga o refresh token atual e limpa o cookie.

O JWT carregará a identidade (`sub`) e claims úteis para a interface, como roles e permissões observadas no login. A API não confiará apenas nessas claims para autorização: o middleware resolverá as permissões efetivas do usuário de forma autoritativa, permitindo refletir alterações administrativas após a renovação ou expiração do token.

Middlewares:

- `authenticateJwt`: valida assinatura, emissor, audiência, expiração e identidade.
- `requirePermission(permission)`: exige uma permissão específica e retorna `403` quando ausente.

Proteção inicial das rotas existentes:

- dashboard, listagem, grupos e estatísticas: `autos.read`;
- exportação Excel/PDF: `autos.export`;
- administração de usuários: `users.manage`;
- administração de roles: `roles.manage`;
- health check: público.

Segurança da API:

- CORS restrito à origem configurada;
- rate limit para login e refresh;
- mensagens genéricas para credenciais inválidas;
- validação de `Origin`/`Referer` nas operações baseadas em cookie;
- cookies sem acesso por JavaScript;
- revogação e detecção de reutilização de refresh tokens;
- logs de auditoria sem registrar senha ou tokens.

### Web

Rotas:

- `/login`: pública;
- `/`: dashboard protegida;
- `/autos`: listagem protegida;
- `/admin/usuarios`: administração de usuários;
- `/admin/roles`: administração de roles.

Um `AuthProvider` manterá em memória o usuário atual, o access token e as permissões. Ao carregar a aplicação, tentará renovar a sessão pelo cookie. O cliente HTTP tentará uma única renovação após `401` e repetirá a requisição original; se falhar, limpará o estado e redirecionará para `/login`.

A interface ocultará menus e ações sem permissão para melhorar a experiência, mas isso não será considerado mecanismo de segurança.

Telas administrativas:

- usuários: busca, paginação, criação, edição, ativação/desativação, atribuição de roles, reset de senha e revogação de sessões;
- roles: listagem, criação/edição, seleção de permissões e visualização do catálogo;
- a API impedirá desativar ou remover a última conta administrativa ativa.

## Bootstrap operacional

Será criado um comando de administração para:

1. aplicar ou verificar as migrations;
2. inserir permissões e roles padrão de forma idempotente;
3. criar o primeiro administrador com entrada interativa de e-mail, nome e senha;
4. impedir duplicação de e-mail.

Senha e tokens não serão gravados em arquivos de configuração ou no repositório.

## Testes e critérios de aceite

- hash e verificação de senha com Argon2id;
- assinatura, expiração e rejeição de JWT inválido;
- rotação, expiração, logout e revogação de refresh tokens;
- login válido, credencial inválida, usuário inativo, `401` e `403`;
- autorização de cada grupo de rotas por permissão;
- migrations aplicadas em banco de teste e verificadas no PostgreSQL final sem tocar nos dados Gold;
- redirecionamento da web para login quando não autenticada;
- renovação automática e logout no cliente;
- telas de usuários e roles com estados de carregamento, erro e sucesso;
- proteção contra remoção do último administrador;
- auditoria dos eventos de autenticação e administração;
- nenhuma senha, access token ou refresh token em logs, localStorage ou respostas de erro.

## Entrega em fases

1. migrations e bootstrap do schema `auth`;
2. serviços de senha, JWT, refresh tokens e auditoria;
3. endpoints de autenticação e middleware de autorização;
4. proteção das rotas existentes;
5. `AuthProvider`, login e renovação de sessão na web;
6. telas administrativas de usuários e roles;
7. testes de integração, validação no banco final e documentação operacional.
