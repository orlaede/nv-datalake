import { getAuthConfig } from "./config"
import {
  createRefreshToken as insertRefreshToken,
  findRefreshToken,
  findUserForAuthentication,
  loadUserById,
  markLastLogin,
  recordAuditEvent,
  revokeAllRefreshTokens,
  revokeRefreshToken,
} from "./repository"
import { verifyPassword } from "./password"
import { createAccessToken, createRefreshToken, hashRefreshToken } from "./tokens"
import { toPublicUser, type AuthContext, type PublicUser } from "./types"

export class AuthError extends Error {
  constructor(
    public readonly code: "INVALID_CREDENTIALS" | "INVALID_SESSION",
    public readonly status: 401 | 403,
    message = code === "INVALID_CREDENTIALS" ? "Credenciais inválidas" : "Sessão inválida"
  ) {
    super(message)
    this.name = "AuthError"
  }
}

export type AuthResult = {
  accessToken: string
  refreshToken: string
  user: PublicUser
}

function expiresAt(days: number): Date {
  return new Date(Date.now() + Math.max(1, days) * 86_400_000)
}

function isExpired(value: Date | string): boolean {
  return new Date(value).getTime() <= Date.now()
}

function invalidSession(context?: AuthContext): AuthError {
  void recordAuditEvent({ eventType: "auth.session_rejected", context }).catch(() => undefined)
  return new AuthError("INVALID_SESSION", 401)
}

async function issueTokens(
  user: Parameters<typeof toPublicUser>[0],
  context: AuthContext
): Promise<AuthResult & { refreshTokenId: string }> {
  const config = getAuthConfig()
  const accessToken = await createAccessToken(
    {
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    },
    config
  )
  const refreshToken = createRefreshToken()
  const storedRefreshToken = await insertRefreshToken({
    userId: user.userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: expiresAt(config.refreshTokenTtlDays),
    context,
  })
  return { accessToken, refreshToken, refreshTokenId: storedRefreshToken.tokenId, user: toPublicUser(user) }
}

export async function login(
  input: { email: string; password: string },
  context: AuthContext = {}
): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase()
  const user = await findUserForAuthentication(email)
  if (!user || !user.isActive || !user.passwordHash || !(await verifyPassword(user.passwordHash, input.password))) {
    await recordAuditEvent({ eventType: "auth.login_failed", metadata: { email }, context }).catch(() => undefined)
    throw new AuthError("INVALID_CREDENTIALS", 401)
  }

  const { refreshTokenId: _refreshTokenId, ...result } = await issueTokens(user, context)
  await markLastLogin(user.userId)
  await recordAuditEvent({ eventType: "auth.login_succeeded", actorUserId: user.userId, context })
  return result
}

export async function refresh(rawRefreshToken: string, context: AuthContext = {}): Promise<AuthResult> {
  const tokenHash = hashRefreshToken(rawRefreshToken)
  const current = await findRefreshToken(tokenHash)
  if (!current) throw invalidSession(context)

  if (current.revokedAt) {
    await revokeAllRefreshTokens(current.userId)
    await recordAuditEvent({
      eventType: "auth.refresh_reuse_detected",
      targetUserId: current.userId,
      context,
    }).catch(() => undefined)
    throw invalidSession(context)
  }

  if (!current.isActive || isExpired(current.expiresAt)) throw invalidSession(context)

  const user = await loadUserById(current.userId)
  if (!user || !user.isActive) throw invalidSession(context)

  const { refreshTokenId, ...result } = await issueTokens(user, context)
  await revokeRefreshToken(current.tokenId, refreshTokenId)
  await recordAuditEvent({ eventType: "auth.refresh_succeeded", actorUserId: user.userId, context })
  return result
}

export async function logout(rawRefreshToken: string | null, _context: AuthContext = {}): Promise<void> {
  if (!rawRefreshToken) return
  const current = await findRefreshToken(hashRefreshToken(rawRefreshToken))
  if (current) await revokeRefreshToken(current.tokenId)
}

export async function getCurrentUser(userId: string): Promise<PublicUser | null> {
  const user = await loadUserById(userId)
  return user && user.isActive ? toPublicUser(user) : null
}
