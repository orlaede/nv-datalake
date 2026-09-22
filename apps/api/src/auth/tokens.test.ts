import { describe, expect, it, vi } from "vitest"
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  parseRefreshCookie,
  serializeRefreshCookie,
  verifyAccessToken,
  type AuthConfig,
} from "./tokens"

const config: AuthConfig = {
  jwtSecret: "test-secret-that-is-long-enough-for-hmac",
  issuer: "test-api",
  audience: "test-web",
  accessTokenTtl: "15m",
  refreshTokenTtlDays: 30,
  refreshCookieName: "test_refresh",
  cookieSecure: false,
}

describe("token primitives", () => {
  it("creates and verifies an access token with identity claims", async () => {
    const token = await createAccessToken(
      {
        userId: "user-1",
        email: "user@example.com",
        roles: ["admin"],
        permissions: ["users.manage"],
      },
      config
    )

    await expect(verifyAccessToken(token, config)).resolves.toMatchObject({
      sub: "user-1",
      email: "user@example.com",
      roles: ["admin"],
      permissions: ["users.manage"],
      type: "access",
    })
    await expect(
      verifyAccessToken(token, { ...config, audience: "another-web" })
    ).rejects.toThrow()
  })

  it("rejects an expired access token", async () => {
    vi.useFakeTimers()
    try {
      const token = await createAccessToken(
        { userId: "user-1", email: "user@example.com", roles: [], permissions: [] },
        { ...config, accessTokenTtl: "1s" }
      )
      vi.advanceTimersByTime(2_000)
      await expect(verifyAccessToken(token, { ...config, accessTokenTtl: "1s" })).rejects.toThrow()
    } finally {
      vi.useRealTimers()
    }
  })

  it("creates opaque refresh tokens whose hashes are not reversible", () => {
    const first = createRefreshToken()
    const second = createRefreshToken()

    expect(first).not.toBe(second)
    expect(first).toMatch(/^[A-Za-z0-9_-]{40,}$/)
    expect(hashRefreshToken(first)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashRefreshToken(first)).not.toBe(first)
  })

  it("serializes and parses the HttpOnly refresh cookie", () => {
    const header = serializeRefreshCookie("raw-token", config, 2_592_000)

    expect(header).toContain("test_refresh=raw-token")
    expect(header).toContain("HttpOnly")
    expect(header).toContain("SameSite=Lax")
    expect(parseRefreshCookie(header, config)).toBe("raw-token")
    expect(parseRefreshCookie("other=value", config)).toBeNull()
  })
})
