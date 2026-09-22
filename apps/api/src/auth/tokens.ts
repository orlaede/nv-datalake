import { createHash, randomBytes } from "node:crypto"
import { SignJWT, jwtVerify, type JWTPayload } from "jose"

export type AuthConfig = {
  jwtSecret: string
  issuer: string
  audience: string
  accessTokenTtl: string
  refreshTokenTtlDays: number
  refreshCookieName: string
  cookieSecure: boolean
}

export type AccessTokenClaims = JWTPayload & {
  sub: string
  email: string
  roles: string[]
  permissions: string[]
  type: "access"
}

type AccessTokenInput = {
  userId: string
  email: string
  roles: string[]
  permissions: string[]
}

function secretKey(config: AuthConfig): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret)
}

export async function createAccessToken(input: AccessTokenInput, config: AuthConfig): Promise<string> {
  return new SignJWT({
    email: input.email,
    roles: input.roles,
    permissions: input.permissions,
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(config.accessTokenTtl)
    .sign(secretKey(config))
}

export async function verifyAccessToken(token: string, config: AuthConfig): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(config), {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ["HS256"],
  })

  if (
    payload.type !== "access" ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    !Array.isArray(payload.roles) ||
    !Array.isArray(payload.permissions)
  ) {
    throw new Error("Invalid access token claims")
  }

  return payload as AccessTokenClaims
}

export function createRefreshToken(): string {
  return randomBytes(32).toString("base64url")
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function serializeRefreshCookie(token: string, config: AuthConfig, maxAgeSeconds?: number): string {
  const maxAge = maxAgeSeconds ?? Math.max(1, Math.floor(config.refreshTokenTtlDays * 86_400))
  const attributes = [
    `${config.refreshCookieName}=${encodeURIComponent(token)}`,
    "Path=/api/auth",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ]
  if (config.cookieSecure) attributes.push("Secure")
  return attributes.join("; ")
}

export function clearRefreshCookie(config: AuthConfig): string {
  return serializeRefreshCookie("", config, 0)
}

export function parseRefreshCookie(cookieHeader: string | undefined, config: AuthConfig = {
  jwtSecret: "unused",
  issuer: "unused",
  audience: "unused",
  accessTokenTtl: "15m",
  refreshTokenTtlDays: 30,
  refreshCookieName: "nv_refresh",
  cookieSecure: false,
}): string | null {
  if (!cookieHeader) return null
  const prefix = `${config.refreshCookieName}=`
  const part = cookieHeader.split(";").map((value) => value.trim()).find((value) => value.startsWith(prefix))
  if (!part) return null
  return decodeURIComponent(part.slice(prefix.length)) || null
}
