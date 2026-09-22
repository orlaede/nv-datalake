import type { AuthConfig } from "./tokens"

const DEVELOPMENT_SECRET = "development-only-change-this-jwt-secret"

export function getAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const production = env.NODE_ENV === "production"
  const jwtSecret = env.AUTH_JWT_SECRET ?? (production ? "" : DEVELOPMENT_SECRET)

  if (!jwtSecret || (production && jwtSecret.length < 32)) {
    throw new Error("AUTH_JWT_SECRET must contain at least 32 characters in production")
  }

  return {
    jwtSecret,
    issuer: env.AUTH_JWT_ISSUER ?? "nv-datalake-api",
    audience: env.AUTH_JWT_AUDIENCE ?? "nv-datalake-web",
    accessTokenTtl: env.AUTH_ACCESS_TOKEN_TTL ?? "15m",
    refreshTokenTtlDays: Number(env.AUTH_REFRESH_TOKEN_TTL_DAYS ?? 30),
    refreshCookieName: env.AUTH_REFRESH_COOKIE_NAME ?? "nv_refresh",
    cookieSecure: env.AUTH_COOKIE_SECURE === "true" || (production && env.AUTH_COOKIE_SECURE !== "false"),
    allowedOrigin: env.AUTH_ALLOWED_ORIGIN ?? "http://localhost:5173",
  }
}
