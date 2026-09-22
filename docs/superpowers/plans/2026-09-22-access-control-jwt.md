# Controle de acesso JWT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved local e-mail/password authentication, JWT sessions, functional authorization, protected web routes, and user/role administration.

**Architecture:** The API owns authentication and authorization. PostgreSQL schema `auth` stores users, roles, permissions, refresh-token hashes, and audit events; short-lived JWT access tokens are held in web memory and rotated refresh tokens are sent in an HttpOnly cookie. The React app delegates every authorization decision to the API and only hides unavailable navigation/actions as a UX aid.

**Tech Stack:** Express 5, PostgreSQL/`pg`, TypeScript, Argon2id, `jose`, `express-rate-limit`, React Router, TanStack Query, Vitest, Testing Library.

---

### Task 1: Authentication dependencies, environment contract, and PostgreSQL migrations

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/package-lock.json`
- Modify: `apps/api/.env.example`
- Modify: `.env.example`
- Modify: `.gitignore`
- Create: `db/migrations/001_auth_schema.sql`
- Create: `db/migrations/002_auth_seed.sql`

- [ ] **Step 1: Add the dependency and environment contract**

Add `argon2`, `express-rate-limit`, and `jose` to API dependencies. Define `AUTH_JWT_SECRET`, issuer, audience, access-token TTL, refresh-token TTL, cookie name, cookie secure flag, and allowed origin in both examples. Ignore `node_modules/` at repository level.

- [ ] **Step 2: Add the `auth` schema migration**

Create UUID-backed tables `auth.users`, `auth.roles`, `auth.permissions`, `auth.user_roles`, `auth.role_permissions`, `auth.refresh_tokens`, and `auth.audit_events`, with lower-case e-mail uniqueness, active flags, foreign keys, refresh-token expiry/revocation fields, JSONB audit metadata, and indexes for e-mail, token hash, user foreign keys, and expiry.

- [ ] **Step 3: Add idempotent seed data**

Insert the approved permissions and `admin`, `operador`, and `consulta` roles with `ON CONFLICT DO NOTHING`, then insert the role-permission mappings without duplicating existing rows.

- [ ] **Step 4: Install dependencies and run migration SQL syntax checks**

Run `npm install` in `apps/api`, `npm run build`, and a PostgreSQL parser/application check in a disposable database if available. Expected: lockfile generated, dependencies installed, and the API still type-checks.

- [ ] **Step 5: Commit the task**

```bash
git add .gitignore .env.example apps/api/package.json apps/api/package-lock.json apps/api/.env.example db/migrations
git commit -m "feat: add auth schema and dependencies"
```

### Task 2: Password, JWT, cookie, and refresh-token primitives

**Files:**
- Create: `apps/api/src/auth/config.ts`
- Create: `apps/api/src/auth/password.ts`
- Create: `apps/api/src/auth/tokens.ts`
- Create: `apps/api/src/auth/password.test.ts`
- Create: `apps/api/src/auth/tokens.test.ts`

- [ ] **Step 1: Write failing tests**

Cover Argon2id hash/verify and rejection of the wrong password; JWT creation/verification, expiration and wrong issuer/audience; random refresh-token hashing; and serialization/parsing of the HttpOnly refresh cookie.

- [ ] **Step 2: Run focused tests and confirm failure**

Run `npm test -- src/auth/password.test.ts src/auth/tokens.test.ts` from `apps/api`. Expected: imports or functions are missing.

- [ ] **Step 3: Implement primitives**

Use `argon2.hash(password, { type: argon2.argon2id })`, `argon2.verify`, `jose.SignJWT`, `jose.jwtVerify`, `crypto.randomBytes(32)`, and SHA-256 for refresh-token storage. Fail closed in production when `AUTH_JWT_SECRET` is missing. Keep access tokens short-lived and refresh tokens opaque.

- [ ] **Step 4: Run focused tests**

Expected: all password, JWT, cookie, and hash tests pass.

- [ ] **Step 5: Commit the task**

```bash
git add apps/api/src/auth
git commit -m "feat: add password and jwt primitives"
```

### Task 3: Authentication repository, service, and endpoints

**Files:**
- Create: `apps/api/src/auth/repository.ts`
- Create: `apps/api/src/auth/service.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/auth/service.test.ts`
- Create: `apps/api/src/routes/auth.test.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Write failing service tests**

Mock `pool.query` and cover successful login, invalid credentials, inactive users, refresh rotation, refresh reuse revocation, logout, and user/permission loading. Assert no password or raw refresh token is returned.

- [ ] **Step 2: Implement repository and service**

Use parameterized SQL only. Normalize e-mail with `trim().toLowerCase()`. Load effective roles/permissions from joins. Persist only the refresh-token hash and audit events. Return a stable public user shape.

- [ ] **Step 3: Write failing endpoint tests**

Use Supertest to cover `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, and `GET /api/auth/me`, including status `401` and cookie behavior.

- [ ] **Step 4: Implement the auth router**

Return `200` for login/refresh/me, `204` for logout, `401` for invalid credentials/session, and set/clear the refresh cookie using the configured path and flags. Add a login rate limiter and generic credential errors.

- [ ] **Step 5: Register the router and run tests**

Run the focused auth tests and the API build. Expected: all focused tests pass and `tsc` exits zero.

- [ ] **Step 6: Commit the task**

```bash
git add apps/api/src/auth apps/api/src/routes/auth.ts apps/api/src/routes/auth.test.ts apps/api/src/server.ts
git commit -m "feat: add jwt authentication endpoints"
```

### Task 4: JWT middleware and protection of existing API routes

**Files:**
- Create: `apps/api/src/auth/middleware.ts`
- Create: `apps/api/src/auth/middleware.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/routes/autosInfracao.test.ts`

- [ ] **Step 1: Write failing middleware tests**

Cover missing/invalid/expired access tokens (`401`), inactive users (`401`), missing permissions (`403`), and valid users reaching a protected handler. Assert effective permissions are loaded from the database rather than trusted solely from JWT claims.

- [ ] **Step 2: Implement middleware**

Add `authenticateJwt` and `requirePermission(permission)`. Attach `{ id, email, name, roles, permissions }` to the request. Restrict CORS to the configured origin and preserve public `/health` and auth endpoints.

- [ ] **Step 3: Protect autos routes**

Require `autos.read` on list/groups/group-rows/suggestions/stats and `autos.export` on Excel/PDF exports. Update existing route tests with explicit test-only auth injection or signed test requests, and add assertions that unauthenticated requests return `401`.

- [ ] **Step 4: Run API tests and build**

Run `npm test` and `npm run build` from `apps/api`. Expected: all API tests pass and the build succeeds.

- [ ] **Step 5: Commit the task**

```bash
git add apps/api/src/auth/middleware.ts apps/api/src/auth/middleware.test.ts apps/api/src/server.ts apps/api/src/routes/autosInfracao.test.ts
git commit -m "feat: protect api routes with permissions"
```

### Task 5: Admin API and first-admin bootstrap command

**Files:**
- Create: `apps/api/src/routes/admin.ts`
- Create: `apps/api/src/routes/admin.test.ts`
- Create: `apps/api/src/scripts/create-admin.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/server.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing admin route tests**

Cover list/create/update/deactivate users, assign roles, revoke sessions, list/create/update roles, list permissions, `403` for insufficient permission, and rejection of deactivating the last active administrator.

- [ ] **Step 2: Implement parameterized admin repository operations and routes**

Use pagination and search for users. Hash passwords on creation/reset. Validate e-mail, role keys, permission keys, active state, and role assignments. Keep permissions migration-controlled while allowing role management.

- [ ] **Step 3: Write and implement the bootstrap command**

Add an npm script that prompts for name, e-mail, and password, verifies the schema/seed exists, hashes the password, inserts an admin user idempotently, and never logs the password.

- [ ] **Step 4: Run admin tests, build, and a dry-run help check**

Expected: admin tests pass, the API builds, and `npm run create-admin -- --help` exits without touching credentials.

- [ ] **Step 5: Commit the task**

```bash
git add apps/api/src/routes/admin.ts apps/api/src/routes/admin.test.ts apps/api/src/scripts/create-admin.ts apps/api/package.json apps/api/src/server.ts README.md
git commit -m "feat: add user and role administration api"
```

### Task 6: Web authentication state, login screen, and protected routes

**Files:**
- Create: `apps/web/src/lib/auth.tsx`
- Create: `apps/web/src/lib/auth.test.tsx`
- Create: `apps/web/src/routes/Login.tsx`
- Create: `apps/web/src/routes/Login.test.tsx`
- Create: `apps/web/src/components/auth/ProtectedRoute.tsx`
- Create: `apps/web/src/components/auth/PermissionGate.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write failing auth-client tests**

Cover login state, refresh-on-load, one retry after `401`, logout, redirect for unauthenticated routes, and permission-gate rendering.

- [ ] **Step 2: Implement the auth provider and API client**

Keep the access token in React state, use `credentials: "include"`, call refresh once on `401`, and redirect only after refresh fails. Expose `user`, `isLoading`, `login`, `logout`, and `hasPermission`.

- [ ] **Step 3: Implement login and route guards**

Make `/login` public and protect dashboard/listing/admin routes. Preserve the current query string when redirecting to login where practical.

- [ ] **Step 4: Run focused web tests and build**

Expected: new auth tests pass. Existing unrelated test failures must be recorded rather than hidden.

- [ ] **Step 5: Commit the task**

```bash
git add apps/web/src/lib/auth.tsx apps/web/src/lib/auth.test.tsx apps/web/src/routes/Login.tsx apps/web/src/routes/Login.test.tsx apps/web/src/components/auth apps/web/src/lib/api.ts apps/web/src/main.tsx apps/web/src/App.tsx apps/web/package.json
git commit -m "feat: add web login and protected routes"
```

### Task 7: User and role administration screens

**Files:**
- Create: `apps/web/src/routes/admin/UsersAdmin.tsx`
- Create: `apps/web/src/routes/admin/UsersAdmin.test.tsx`
- Create: `apps/web/src/routes/admin/RolesAdmin.tsx`
- Create: `apps/web/src/routes/admin/RolesAdmin.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Write failing screen tests**

Cover loading/error/empty states, user search and pagination, create/edit/deactivate/role assignment actions, role permission selection, and hiding admin navigation without permission.

- [ ] **Step 2: Implement user administration**

Use existing cards, tables, inputs, buttons and sheet/dialog primitives. Submit only validated fields and display server errors without exposing sensitive details.

- [ ] **Step 3: Implement role administration and navigation**

Add `/admin/usuarios` and `/admin/roles`, show the navigation only with the matching permission, and keep API protection authoritative.

- [ ] **Step 4: Run focused web tests**

Expected: both admin screen test files pass.

- [ ] **Step 5: Commit the task**

```bash
git add apps/web/src/routes/admin apps/web/src/App.tsx apps/web/src/components/layout/AppShell.tsx
git commit -m "feat: add user and role admin screens"
```

### Task 8: Integration verification, migration validation, and final documentation

**Files:**
- Modify: `README.md`
- Modify: `apps/api/.env.example`
- Modify: `apps/web/.env.example`
- Create: `apps/api/src/auth/integration.test.ts`

- [ ] **Step 1: Add integration coverage**

Exercise login → protected API request → refresh → logout with a test database or repository fixture, and verify no response/log fixture contains a password or raw refresh token.

- [ ] **Step 2: Validate the final database migration**

Apply `db/migrations/001_auth_schema.sql` and `002_auth_seed.sql` to a disposable database first, then inspect the final PostgreSQL schema and only apply idempotent migrations to the configured Data Lake database after confirming the target is correct.

- [ ] **Step 3: Run the complete verification set**

Run API tests/build, focused web auth/admin tests, web build, `git diff --check`, and a live smoke test for `/health`, `/api/auth/login`, and one protected endpoint. Record any pre-existing failures separately from auth failures.

- [ ] **Step 4: Update operational documentation**

Document environment variables, migration order, first-admin command, cookie/proxy requirements, and the permission matrix in `README.md`.

- [ ] **Step 5: Commit the task**

```bash
git add README.md apps/api/.env.example apps/web/.env.example apps/api/src/auth/integration.test.ts
git commit -m "docs: document jwt access control operations"
```
