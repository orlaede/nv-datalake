import { describe, expect, it, vi, beforeEach } from "vitest"
import type { NextFunction, Request, Response } from "express"
import { loadUserById } from "./repository"
import { verifyAccessToken } from "./tokens"
import { authenticateJwt, requirePermission } from "./middleware"

vi.mock("./repository", () => ({ loadUserById: vi.fn() }))
vi.mock("./tokens", () => ({ verifyAccessToken: vi.fn() }))

const user = {
  userId: "user-1",
  email: "user@example.com",
  fullName: "Usuário Teste",
  isActive: true,
  roles: ["operador"],
  permissions: ["dashboard.read", "autos.read"],
}

function requestWithAuthorization(authorization?: string) {
  return {
    get: vi.fn((header: string) => (header.toLowerCase() === "authorization" ? authorization : undefined)),
  } as unknown as Request
}

function responseMock() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response
  vi.mocked(res.status).mockReturnValue(res)
  return res
}

describe("JWT middleware", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects requests without a bearer token", async () => {
    const req = requestWithAuthorization()
    const res = responseMock()
    const next = vi.fn() as NextFunction

    await authenticateJwt(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: "Autenticação necessária" })
    expect(next).not.toHaveBeenCalled()
  })

  it("verifies the token, loads the active user and attaches a public user", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      sub: "user-1",
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      type: "access",
    })
    vi.mocked(loadUserById).mockResolvedValue(user)
    const req = requestWithAuthorization("Bearer access-token")
    const res = responseMock()
    const next = vi.fn() as NextFunction

    await authenticateJwt(req, res, next)

    expect(verifyAccessToken).toHaveBeenCalledWith("access-token", expect.any(Object))
    expect(loadUserById).toHaveBeenCalledWith("user-1")
    expect((req as { authUser?: unknown }).authUser).toEqual({
      id: "user-1",
      email: user.email,
      name: user.fullName,
      roles: user.roles,
      permissions: user.permissions,
    })
    expect(next).toHaveBeenCalledOnce()
  })

  it("rejects invalid tokens and inactive users", async () => {
    vi.mocked(verifyAccessToken).mockRejectedValueOnce(new Error("expired"))
    const invalidResponse = responseMock()
    await authenticateJwt(requestWithAuthorization("Bearer expired"), invalidResponse, vi.fn())
    expect(invalidResponse.status).toHaveBeenCalledWith(401)

    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: "user-1",
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      type: "access",
    })
    vi.mocked(loadUserById).mockResolvedValueOnce({ ...user, isActive: false })
    const inactiveResponse = responseMock()
    await authenticateJwt(requestWithAuthorization("Bearer inactive"), inactiveResponse, vi.fn())
    expect(inactiveResponse.status).toHaveBeenCalledWith(401)
  })

  it("requires the declared functional permission", () => {
    const middleware = requirePermission("autos.export")
    const req = { authUser: { id: "user-1", email: user.email, name: user.fullName, roles: user.roles, permissions: user.permissions } }
    const res = responseMock()
    const next = vi.fn() as NextFunction

    middleware(req as never, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: "Permissão insuficiente" })
    expect(next).not.toHaveBeenCalled()
  })
})
