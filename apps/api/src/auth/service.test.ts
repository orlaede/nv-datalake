import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createRefreshToken as insertRefreshToken,
  findRefreshToken,
  findUserForAuthentication,
  loadUserById,
  markLastLogin,
  recordAuditEvent,
  revokeRefreshToken,
} from "./repository"
import { verifyPassword } from "./password"
import { createAccessToken, createRefreshToken, hashRefreshToken } from "./tokens"
import { AuthError, login, logout, refresh } from "./service"

vi.mock("./repository", () => ({
  createRefreshToken: vi.fn(),
  findRefreshToken: vi.fn(),
  findUserForAuthentication: vi.fn(),
  loadUserById: vi.fn(),
  markLastLogin: vi.fn(),
  recordAuditEvent: vi.fn(),
  revokeAllRefreshTokens: vi.fn(),
  revokeRefreshToken: vi.fn(),
}))

vi.mock("./password", () => ({ verifyPassword: vi.fn() }))

vi.mock("./tokens", () => ({
  createAccessToken: vi.fn(),
  createRefreshToken: vi.fn(),
  hashRefreshToken: vi.fn(),
}))

const user = {
  userId: "user-1",
  email: "user@example.com",
  fullName: "Usuário Teste",
  passwordHash: "argon-hash",
  isActive: true,
  roles: ["operador"],
  permissions: ["dashboard.read", "autos.read", "autos.export"],
}

describe("auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(createAccessToken).mockResolvedValue("access-token")
    vi.mocked(createRefreshToken).mockReturnValue("refresh-token")
    vi.mocked(hashRefreshToken).mockReturnValue("refresh-hash")
    vi.mocked(insertRefreshToken).mockResolvedValue({ tokenId: "token-1" })
    vi.mocked(markLastLogin).mockResolvedValue(undefined)
    vi.mocked(recordAuditEvent).mockResolvedValue(undefined)
  })

  it("logs in with a normalized email and never returns the password hash", async () => {
    vi.mocked(findUserForAuthentication).mockResolvedValue(user)

    const result = await login(
      { email: " User@Example.com ", password: "secret" },
      { ipAddress: "127.0.0.1", userAgent: "test" }
    )

    expect(findUserForAuthentication).toHaveBeenCalledWith("user@example.com")
    expect(result).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "Usuário Teste",
        roles: ["operador"],
        permissions: ["dashboard.read", "autos.read", "autos.export"],
      },
    })
    expect(result.user).not.toHaveProperty("passwordHash")
    expect(insertRefreshToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      tokenHash: "refresh-hash",
      context: { ipAddress: "127.0.0.1", userAgent: "test" },
    }))
    expect(markLastLogin).toHaveBeenCalledWith("user-1")
  })

  it("rejects invalid credentials with a generic 401 error", async () => {
    vi.mocked(findUserForAuthentication).mockResolvedValue(null)

    await expect(login({ email: "missing@example.com", password: "secret" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      status: 401,
    })
    expect(verifyPassword).not.toHaveBeenCalled()
  })

  it("rotates a valid refresh token and revokes the token that was used", async () => {
    vi.mocked(findRefreshToken).mockResolvedValue({
      tokenId: "old-token",
      userId: "user-1",
      tokenHash: "refresh-hash",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      isActive: true,
    })
    vi.mocked(loadUserById).mockResolvedValue({
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      isActive: true,
      roles: user.roles,
      permissions: user.permissions,
    })
    vi.mocked(createRefreshToken).mockReturnValueOnce("new-refresh-token")
    vi.mocked(hashRefreshToken)
      .mockReturnValueOnce("old-refresh-hash")
      .mockReturnValueOnce("new-refresh-hash")
    vi.mocked(insertRefreshToken).mockResolvedValue({ tokenId: "new-token" })

    const result = await refresh("old-refresh-token", { ipAddress: "127.0.0.1" })

    expect(result.refreshToken).toBe("new-refresh-token")
    expect(revokeRefreshToken).toHaveBeenCalledWith("old-token", "new-token")
    expect(insertRefreshToken).toHaveBeenCalledWith(expect.objectContaining({
      tokenHash: "new-refresh-hash",
      userId: "user-1",
    }))
  })

  it("rejects an inactive user and revokes a logout token", async () => {
    vi.mocked(findRefreshToken).mockResolvedValue({
      tokenId: "token-1",
      userId: "user-1",
      tokenHash: "refresh-hash",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      isActive: false,
    })

    await expect(refresh("refresh-token")).rejects.toBeInstanceOf(AuthError)

    await logout("refresh-token")
    expect(revokeRefreshToken).toHaveBeenCalledWith("token-1")
  })
})
