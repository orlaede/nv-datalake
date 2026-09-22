import { beforeEach, describe, expect, it, vi } from "vitest"
import request from "supertest"
import { createAccessToken } from "./tokens"
import { getAuthConfig } from "./config"
import { createApp } from "../server"
import * as authService from "./service"
import { loadUserById } from "./repository"
import { pool } from "../db"

vi.mock("./service", async () => {
  const actual = await vi.importActual<typeof import("./service")>("./service")
  return { ...actual, login: vi.fn(), refresh: vi.fn(), logout: vi.fn() }
})

vi.mock("./repository", () => ({ loadUserById: vi.fn() }))
vi.mock("../db", () => ({ pool: { query: vi.fn() } }))

const userRecord = {
  userId: "user-1",
  email: "user@example.com",
  fullName: "Usuário Teste",
  isActive: true,
  roles: ["operador"],
  permissions: ["dashboard.read", "autos.read", "autos.export"],
}

describe("authentication integration flow", () => {
  beforeEach(() => vi.clearAllMocks())

  it("logs in, accesses a protected endpoint, refreshes and logs out", async () => {
    const accessToken = await createAccessToken({
      userId: userRecord.userId,
      email: userRecord.email,
      roles: userRecord.roles,
      permissions: userRecord.permissions,
    }, getAuthConfig())
    const refreshedAccessToken = await createAccessToken({
      userId: userRecord.userId,
      email: userRecord.email,
      roles: userRecord.roles,
      permissions: userRecord.permissions,
    }, getAuthConfig())

    vi.mocked(authService.login).mockResolvedValue({ accessToken, refreshToken: "raw-refresh-token", user: {
      id: userRecord.userId,
      email: userRecord.email,
      name: userRecord.fullName,
      roles: userRecord.roles,
      permissions: userRecord.permissions,
    } })
    vi.mocked(authService.refresh).mockResolvedValue({ accessToken: refreshedAccessToken, refreshToken: "rotated-refresh-token", user: {
      id: userRecord.userId,
      email: userRecord.email,
      name: userRecord.fullName,
      roles: userRecord.roles,
      permissions: userRecord.permissions,
    } })
    vi.mocked(loadUserById).mockResolvedValue(userRecord)
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ count: "1" }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 1, data_hora: "2026-09-22T12:00:00Z" }] } as never)

    const app = createApp()
    const loggedIn = await request(app).post("/api/auth/login").send({ email: userRecord.email, password: "secret" })
    const cookie = loggedIn.headers["set-cookie"][0]

    expect(loggedIn.status).toBe(200)
    expect(loggedIn.body).not.toHaveProperty("refreshToken")
    expect(JSON.stringify(loggedIn.body)).not.toContain("raw-refresh-token")

    const protectedResponse = await request(app)
      .get("/api/autos-infracao")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ page: 1, pageSize: 20 })
    expect(protectedResponse.status).toBe(200)

    const currentUser = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`)
    expect(currentUser.status).toBe(200)
    expect(currentUser.body.user).not.toHaveProperty("passwordHash")

    const refreshed = await request(app).post("/api/auth/refresh").set("Cookie", cookie)
    expect(refreshed.status).toBe(200)
    expect(refreshed.body).not.toHaveProperty("refreshToken")

    const loggedOut = await request(app).post("/api/auth/logout").set("Cookie", "nv_refresh=rotated-refresh-token")
    expect(loggedOut.status).toBe(204)
    expect(loggedOut.headers["set-cookie"][0]).toContain("Max-Age=0")
  })
})
