import { pool } from "../db"
import type { AuthContext, AuthUserRecord, RefreshTokenRecord } from "./types"

type UserQueryRow = {
  user_id: string
  email: string
  full_name: string
  password_hash?: string
  is_active: boolean
  roles: string[]
  permissions: string[]
}

function mapUser(row: UserQueryRow): AuthUserRecord {
  return {
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    roles: row.roles ?? [],
    permissions: row.permissions ?? [],
  }
}

const userSelect = `
  SELECT
    u.user_id,
    u.email,
    u.full_name,
    u.is_active,
    COALESCE(array_agg(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL), ARRAY[]::text[]) AS roles,
    COALESCE(array_agg(DISTINCT p.permission_key) FILTER (WHERE p.permission_key IS NOT NULL), ARRAY[]::text[]) AS permissions
  FROM auth.users u
  LEFT JOIN auth.user_roles ur ON ur.user_id = u.user_id
  LEFT JOIN auth.roles r ON r.role_id = ur.role_id AND r.is_active
  LEFT JOIN auth.role_permissions rp ON rp.role_id = r.role_id
  LEFT JOIN auth.permissions p ON p.permission_id = rp.permission_id
`

export async function findUserForAuthentication(email: string): Promise<AuthUserRecord | null> {
  const result = await pool.query<UserQueryRow>(
    `${userSelect.replace("u.is_active,", "u.password_hash, u.is_active,")}
     WHERE lower(u.email) = $1
     GROUP BY u.user_id, u.email, u.full_name, u.password_hash, u.is_active`,
    [email]
  )
  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function loadUserById(userId: string): Promise<AuthUserRecord | null> {
  const result = await pool.query<UserQueryRow>(
    `${userSelect}
     WHERE u.user_id = $1
     GROUP BY u.user_id, u.email, u.full_name, u.is_active`,
    [userId]
  )
  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function createRefreshToken(input: {
  userId: string
  tokenHash: string
  expiresAt: Date
  context: AuthContext
}): Promise<{ tokenId: string }> {
  const result = await pool.query<{ token_id: string }>(
    `INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING token_id`,
    [input.userId, input.tokenHash, input.expiresAt, input.context.ipAddress ?? null, input.context.userAgent ?? null]
  )
  return { tokenId: result.rows[0].token_id }
}

export async function findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
  const result = await pool.query<RefreshTokenRecord>(
    `SELECT
       token_id AS "tokenId",
       user_id AS "userId",
       token_hash AS "tokenHash",
       expires_at AS "expiresAt",
       revoked_at AS "revokedAt",
       u.is_active AS "isActive"
     FROM auth.refresh_tokens t
     JOIN auth.users u ON u.user_id = t.user_id
     WHERE t.token_hash = $1`,
    [tokenHash]
  )
  return result.rows[0] ?? null
}

export async function revokeRefreshToken(tokenId: string, replacedByTokenId?: string): Promise<void> {
  await pool.query(
    `UPDATE auth.refresh_tokens
     SET revoked_at = COALESCE(revoked_at, now()), replaced_by_token_id = COALESCE($2, replaced_by_token_id)
     WHERE token_id = $1`,
    [tokenId, replacedByTokenId ?? null]
  )
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await pool.query(
    `UPDATE auth.refresh_tokens
     SET revoked_at = COALESCE(revoked_at, now())
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  )
}

export async function markLastLogin(userId: string): Promise<void> {
  await pool.query(`UPDATE auth.users SET last_login_at = now(), updated_at = now() WHERE user_id = $1`, [userId])
}

export async function recordAuditEvent(input: {
  eventType: string
  actorUserId?: string
  targetUserId?: string
  metadata?: Record<string, unknown>
  context?: AuthContext
}): Promise<void> {
  await pool.query(
    `INSERT INTO auth.audit_events
       (event_type, actor_user_id, target_user_id, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
    [
      input.eventType,
      input.actorUserId ?? null,
      input.targetUserId ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.context?.ipAddress ?? null,
      input.context?.userAgent ?? null,
    ]
  )
}
