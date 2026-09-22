import { beforeEach, describe, expect, it, vi } from "vitest"
import request from "supertest"
import { createApp } from "../server"
import { AuthError } from "../auth/service"
import * as authService from "../auth/service"

vi.mock("../auth/service", async () => {
  const actual = await vi.importActual<typeof import("../auth/service")>("../auth/service")
  return {
    ...actual,
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  }
})

const publicUser = {
  id: "user-1",
  email: "user@example.com",
  name: "Usuário Teste",
  roles: ["admin"],
  permissions: ["users.manage"],
}

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns an access token and sets an HttpOnly refresh cookie after login", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: publicUser,
    })

    const response = await request(createApp()).post("/api/auth/login").send({
      email: "user@example.com",
      password: "secret",
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ accessToken: "access-token", user: publicUser })
    expect(response.headers["set-cookie"]).toEqual([
      expect.stringContaining("nv_refresh=refresh-token; Path=/api/auth; Max-Age=2592000; HttpOnly"),
    ])
  })

  it("returns 401 with a generic error for invalid credentials", async () => {
    vi.mocked(authService.login).mockRejectedValue(new AuthError("INVALID_CREDENTIALS", 401))

    const response = await request(createApp()).post("/api/auth/login").send({
      email: "user@example.com",
      password: "wrong",
    })

    expect(response.status).toBe(401)
    expect(response.body).toEqual({ error: "Credenciais inválidas" })
  })

  it("rotates the refresh cookie and clears it on logout", async () => {
    vi.mocked(authService.refresh).mockResolvedValue({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      user: publicUser,
    })

    const app = createApp()
    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "nv_refresh=old-refresh-token")
      .set("User-Agent", "test-agent")

    expect(refreshed.status).toBe(200)
    expect(refreshed.body.accessToken).toBe("new-access-token")
    expect(authService.refresh).toHaveBeenCalledWith(
      "old-refresh-token",
      expect.objectContaining({ userAgent: expect.any(String) })
    )

    const loggedOut = await request(app).post("/api/auth/logout").set("Cookie", "nv_refresh=new-refresh-token")
    expect(loggedOut.status).toBe(204)
    expect(authService.logout).toHaveBeenCalledWith("new-refresh-token", expect.any(Object))
    expect(loggedOut.headers["set-cookie"]).toEqual([expect.stringContaining("Max-Age=0")])
  })
})
