import { pool } from "../db"
import type { PoolClient } from "pg"

export class AdminValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdminValidationError"
  }
}

export class AdminConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdminConflictError"
  }
}

export type AdminUser = {
  id: string
  email: string
  name: string
  isActive: boolean
  roles: string[]
  permissions: string[]
  createdAt?: Date | string
  lastLoginAt?: Date | string | null
}

export type AdminRole = {
  id: string
  key: string
  name: string
  description: string
  isActive: boolean
  permissions: string[]
}

export type AdminPermission = {
  key: string
  name: string
  description: string
}

type AdminUserRow = {
  id: string
  email: string
  name: string
  is_active: boolean
  roles: string[]
  permissions: string[]
  created_at: Date | string
  last_login_at: Date | string | null
}

type AdminRoleRow = {
  id: string
  key: string
  name: string
  description: string
  is_active: boolean
  permissions: string[]
}

function mapAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: row.is_active,
    roles: row.roles ?? [],
    permissions: row.permissions ?? [],
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }
}

function mapAdminRole(row: AdminRoleRow): AdminRole {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    permissions: row.permissions ?? [],
  }
}

const userSelect = `
  SELECT
    u.user_id AS id,
    u.email,
    u.full_name AS name,
    u.is_active,
    u.created_at,
    u.last_login_at,
    COALESCE(array_agg(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL), ARRAY[]::text[]) AS roles,
    COALESCE(array_agg(DISTINCT p.permission_key) FILTER (WHERE p.permission_key IS NOT NULL), ARRAY[]::text[]) AS permissions
  FROM auth.users u
  LEFT JOIN auth.user_roles ur ON ur.user_id = u.user_id
  LEFT JOIN auth.roles r ON r.role_id = ur.role_id AND r.is_active
  LEFT JOIN auth.role_permissions rp ON rp.role_id = r.role_id
  LEFT JOIN auth.permissions p ON p.permission_id = rp.permission_id
`

const userGroupBy = `
  GROUP BY u.user_id, u.email, u.full_name, u.is_active, u.created_at, u.last_login_at
`

async function loadAdminUser(userId: string): Promise<AdminUser> {
  const result = await pool.query<AdminUserRow>(
    `${userSelect} WHERE u.user_id = $1 ${userGroupBy}`,
    [userId]
  )
  if (!result.rows[0]) throw new AdminValidationError("Usuário não encontrado")
  return mapAdminUser(result.rows[0])
}

async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await work(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

async function assertRoleKeys(client: PoolClient, roleKeys: string[]) {
  const uniqueKeys = [...new Set(roleKeys)]
  const result = await client.query<{ role_key: string }>(
    `SELECT role_key FROM auth.roles WHERE role_key = ANY($1::text[]) AND is_active`,
    [uniqueKeys]
  )
  if (result.rows.length !== uniqueKeys.length) throw new AdminValidationError("Role inválida")
  return uniqueKeys
}

async function assertPermissionKeys(client: PoolClient, permissionKeys: string[]) {
  const uniqueKeys = [...new Set(permissionKeys)]
  const result = await client.query<{ permission_key: string }>(
    `SELECT permission_key FROM auth.permissions WHERE permission_key = ANY($1::text[])`,
    [uniqueKeys]
  )
  if (result.rows.length !== uniqueKeys.length) throw new AdminValidationError("Permissão inválida")
  return uniqueKeys
}

export async function listAdminUsers(input: { search: string; page: number; pageSize: number }) {
  const search = `%${input.search.trim()}%`
  const offset = (input.page - 1) * input.pageSize
  const where = `WHERE ($1 = '%%' OR u.email ILIKE $1 OR u.full_name ILIKE $1)`
  const [usersResult, countResult] = await Promise.all([
    pool.query<AdminUserRow>(
      `${userSelect} ${where} ${userGroupBy} ORDER BY u.full_name, u.email LIMIT $2 OFFSET $3`,
      [search, input.pageSize, offset]
    ),
    pool.query<{ count: string }>(`SELECT COUNT(*) FROM auth.users u ${where}`, [search]),
  ])
  return { users: usersResult.rows.map(mapAdminUser), total: Number(countResult.rows[0]?.count ?? 0) }
}

export async function createAdminUser(input: {
  email: string
  fullName: string
  passwordHash: string
  roles: string[]
  actorUserId?: string
}): Promise<AdminUser> {
  const userId = await withTransaction(async (client) => {
    const roleKeys = await assertRoleKeys(client, input.roles)
    const inserted = await client.query<{ user_id: string }>(
      `INSERT INTO auth.users (email, full_name, password_hash)
       VALUES (lower($1), $2, $3)
       RETURNING user_id`,
      [input.email, input.fullName, input.passwordHash]
    )
    const userId = inserted.rows[0].user_id
    await client.query(
      `INSERT INTO auth.user_roles (user_id, role_id)
       SELECT $1, role_id FROM auth.roles WHERE role_key = ANY($2::text[])`,
      [userId, roleKeys]
    )
    return userId
  })
  return loadAdminUser(userId)
}

export async function updateAdminUser(
  userId: string,
  input: {
    email?: string
    fullName?: string
    passwordHash?: string
    isActive?: boolean
    roles?: string[]
    actorUserId?: string
  }
): Promise<AdminUser> {
  await withTransaction(async (client) => {
    const current = await client.query<{ is_active: boolean; is_admin: boolean }>(
      `SELECT u.is_active, EXISTS (
         SELECT 1 FROM auth.user_roles ur JOIN auth.roles r ON r.role_id = ur.role_id
         WHERE ur.user_id = u.user_id AND r.role_key = 'admin' AND r.is_active
       ) AS is_admin
       FROM auth.users u WHERE u.user_id = $1`,
      [userId]
    )
    if (!current.rows[0]) throw new AdminValidationError("Usuário não encontrado")

    const roleKeys = input.roles ? await assertRoleKeys(client, input.roles) : undefined
    const willBeActive = input.isActive ?? current.rows[0].is_active
    const willBeAdmin = roleKeys ? roleKeys.includes("admin") : current.rows[0].is_admin
    if (current.rows[0].is_active && current.rows[0].is_admin && (!willBeActive || !willBeAdmin)) {
      const activeAdmins = await client.query<{ count: string }>(
        `SELECT COUNT(*) FROM auth.users u
         JOIN auth.user_roles ur ON ur.user_id = u.user_id
         JOIN auth.roles r ON r.role_id = ur.role_id
         WHERE u.is_active AND r.is_active AND r.role_key = 'admin'`,
      )
      if (Number(activeAdmins.rows[0]?.count ?? 0) <= 1) {
        throw new AdminConflictError("Não é possível desativar o último administrador ativo")
      }
    }

    const updates: string[] = []
    const values: unknown[] = []
    const add = (column: string, value: unknown) => {
      values.push(value)
      updates.push(`${column} = $${values.length}`)
    }
    if (input.email !== undefined) add("email", input.email.toLowerCase())
    if (input.fullName !== undefined) add("full_name", input.fullName)
    if (input.passwordHash !== undefined) {
      add("password_hash", input.passwordHash)
      updates.push("password_changed_at = now()")
    }
    if (input.isActive !== undefined) add("is_active", input.isActive)
    if (updates.length) {
      updates.push("updated_at = now()")
      values.push(userId)
      await client.query(`UPDATE auth.users SET ${updates.join(", ")} WHERE user_id = $${values.length}`, values)
    }
    if (roleKeys) {
      await client.query(`DELETE FROM auth.user_roles WHERE user_id = $1`, [userId])
      await client.query(
        `INSERT INTO auth.user_roles (user_id, role_id)
         SELECT $1, role_id FROM auth.roles WHERE role_key = ANY($2::text[])`,
        [userId, roleKeys]
      )
    }
  })
  return loadAdminUser(userId)
}

export async function revokeAdminUserSessions(userId: string): Promise<number> {
  const result = await pool.query(
    `UPDATE auth.refresh_tokens SET revoked_at = COALESCE(revoked_at, now())
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  )
  return result.rowCount ?? 0
}

const roleSelect = `
  SELECT
    r.role_id AS id,
    r.role_key AS key,
    r.name,
    r.description,
    r.is_active,
    COALESCE(array_agg(DISTINCT p.permission_key) FILTER (WHERE p.permission_key IS NOT NULL), ARRAY[]::text[]) AS permissions
  FROM auth.roles r
  LEFT JOIN auth.role_permissions rp ON rp.role_id = r.role_id
  LEFT JOIN auth.permissions p ON p.permission_id = rp.permission_id
`

export async function listAdminRoles(): Promise<AdminRole[]> {
  const result = await pool.query<AdminRoleRow>(`${roleSelect} GROUP BY r.role_id ORDER BY r.name`)
  return result.rows.map(mapAdminRole)
}

export async function createAdminRole(input: {
  key: string
  name: string
  description: string
  permissions: string[]
  actorUserId?: string
}): Promise<AdminRole> {
  const roleId = await withTransaction(async (client) => {
    const permissionKeys = await assertPermissionKeys(client, input.permissions)
    const inserted = await client.query<{ role_id: string }>(
      `INSERT INTO auth.roles (role_key, name, description) VALUES ($1, $2, $3) RETURNING role_id`,
      [input.key, input.name, input.description]
    )
    const roleId = inserted.rows[0].role_id
    if (permissionKeys.length) {
      await client.query(
        `INSERT INTO auth.role_permissions (role_id, permission_id)
         SELECT $1, permission_id FROM auth.permissions WHERE permission_key = ANY($2::text[])`,
        [roleId, permissionKeys]
      )
    }
    return roleId
  })
  const result = await pool.query<AdminRoleRow>(`${roleSelect} WHERE r.role_id = $1 GROUP BY r.role_id`, [roleId])
  return mapAdminRole(result.rows[0])
}

export async function updateAdminRole(
  roleId: string,
  input: { key?: string; name?: string; description?: string; isActive?: boolean; permissions?: string[]; actorUserId?: string }
): Promise<AdminRole> {
  await withTransaction(async (client) => {
    if (input.permissions) await assertPermissionKeys(client, input.permissions)
    const updates: string[] = []
    const values: unknown[] = []
    const add = (column: string, value: unknown) => {
      values.push(value)
      updates.push(`${column} = $${values.length}`)
    }
    if (input.key !== undefined) add("role_key", input.key)
    if (input.name !== undefined) add("name", input.name)
    if (input.description !== undefined) add("description", input.description)
    if (input.isActive !== undefined) add("is_active", input.isActive)
    if (updates.length) {
      updates.push("updated_at = now()")
      values.push(roleId)
      await client.query(`UPDATE auth.roles SET ${updates.join(", ")} WHERE role_id = $${values.length}`, values)
    }
    if (input.permissions) {
      await client.query(`DELETE FROM auth.role_permissions WHERE role_id = $1`, [roleId])
      if (input.permissions.length) {
        await client.query(
          `INSERT INTO auth.role_permissions (role_id, permission_id)
           SELECT $1, permission_id FROM auth.permissions WHERE permission_key = ANY($2::text[])`,
          [roleId, input.permissions]
        )
      }
    }
  })
  const result = await pool.query<AdminRoleRow>(`${roleSelect} WHERE r.role_id = $1 GROUP BY r.role_id`, [roleId])
  if (!result.rows[0]) throw new AdminValidationError("Role não encontrada")
  return mapAdminRole(result.rows[0])
}

export async function listAdminPermissions(): Promise<AdminPermission[]> {
  const result = await pool.query<AdminPermission>(
    `SELECT permission_key AS key, name, description FROM auth.permissions ORDER BY name`
  )
  return result.rows
}
