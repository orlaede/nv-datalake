import express from "express"
import { beforeEach, describe, expect, it, vi } from "vitest"
import request from "supertest"
import { adminRouter } from "./admin"
import {
  AdminConflictError,
  createAdminRole,
  createAdminUser,
  listAdminPermissions,
  listAdminRoles,
  listAdminUsers,
  revokeAdminUserSessions,
  updateAdminRole,
  updateAdminUser,
} from "../auth/adminRepository"

let currentPermissions = ["users.read", "users.manage", "roles.manage"]

vi.mock("../auth/middleware", () => ({
  authenticateJwt: (req: { authUser?: unknown }, _res: unknown, next: () => void) => {
    req.authUser = {
      id: "admin-1",
      email: "admin@example.com",
      name: "Administrador",
      roles: ["admin"],
      permissions: currentPermissions,
    }
    next()
  },
  requirePermission: (permission: string) =>
    (req: { authUser?: { permissions: string[] } }, res: { status: (code: number) => typeof res; json: (body: unknown) => void }, next: () => void) => {
      if (!req.authUser) {
        res.status(401).json({ error: "Autenticação necessária" })
        return
      }
      if (!req.authUser.permissions.includes(permission)) {
        res.status(403).json({ error: "Permissão insuficiente" })
        return
      }
      next()
    },
}))

vi.mock("../auth/adminRepository", () => ({
  AdminConflictError: class AdminConflictError extends Error {},
  createAdminRole: vi.fn(),
  createAdminUser: vi.fn(),
  listAdminPermissions: vi.fn(),
  listAdminRoles: vi.fn(),
  listAdminUsers: vi.fn(),
  revokeAdminUserSessions: vi.fn(),
  updateAdminRole: vi.fn(),
  updateAdminUser: vi.fn(),
}))

const app = express().use(express.json()).use(adminRouter)

const user = {
  id: "user-1",
  email: "user@example.com",
  name: "Usuário Teste",
  isActive: true,
  roles: ["consulta"],
  permissions: ["dashboard.read", "autos.read"],
}

describe("admin routes", () => {
  beforeEach(() => {
    currentPermissions = ["users.read", "users.manage", "roles.manage"]
    vi.clearAllMocks()
  })

  it("lists users with pagination and search", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue({ users: [user], total: 1 })

    const response = await request(app).get("/api/admin/users").query({ q: "user", page: 2, pageSize: 10 })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ items: [user], total: 1, page: 2, pageSize: 10 })
    expect(listAdminUsers).toHaveBeenCalledWith({ search: "user", page: 2, pageSize: 10 })
  })

  it("creates, updates and revokes a user's sessions", async () => {
    vi.mocked(createAdminUser).mockResolvedValue(user)
    vi.mocked(updateAdminUser).mockResolvedValue({ ...user, name: "Nome Atualizado" })
    vi.mocked(revokeAdminUserSessions).mockResolvedValue(3)

    const created = await request(app).post("/api/admin/users").send({
      email: "user@example.com",
      name: "Usuário Teste",
      password: "uma-senha-segura",
      roles: ["consulta"],
    })
    const updated = await request(app).patch("/api/admin/users/user-1").send({ name: "Nome Atualizado" })
    const revoked = await request(app).post("/api/admin/users/user-1/revoke-sessions")

    expect(created.status).toBe(201)
    expect(created.body).toEqual({ user })
    expect(updated.status).toBe(200)
    expect(updated.body.user.name).toBe("Nome Atualizado")
    expect(revoked.status).toBe(200)
    expect(revoked.body).toEqual({ revoked: 3 })
    expect(createAdminUser).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "admin-1" }))
    expect(updateAdminUser).toHaveBeenCalledWith("user-1", expect.objectContaining({ actorUserId: "admin-1" }))
  })

  it("returns 409 when an update would deactivate the last administrator", async () => {
    vi.mocked(updateAdminUser).mockRejectedValue(new AdminConflictError("last admin"))

    const response = await request(app).patch("/api/admin/users/admin-1").send({ isActive: false })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ error: "Não é possível desativar o último administrador ativo" })
  })

  it("protects admin operations with their functional permission", async () => {
    currentPermissions = ["users.read"]

    const response = await request(app).post("/api/admin/users").send({})

    expect(response.status).toBe(403)
    expect(createAdminUser).not.toHaveBeenCalled()
  })

  it("lists, creates and updates roles and lists permissions", async () => {
    vi.mocked(listAdminRoles).mockResolvedValue([{ id: "role-1", key: "operador", name: "Operador", description: "", isActive: true, permissions: ["autos.read"] }])
    vi.mocked(createAdminRole).mockResolvedValue({ id: "role-2", key: "auditor", name: "Auditor", description: "", isActive: true, permissions: [] })
    vi.mocked(updateAdminRole).mockResolvedValue({ id: "role-2", key: "auditor", name: "Auditor", description: "Atualizado", isActive: true, permissions: ["autos.read"] })
    vi.mocked(listAdminPermissions).mockResolvedValue([{ key: "autos.read", name: "Consultar autos", description: "" }])

    const roles = await request(app).get("/api/admin/roles")
    const created = await request(app).post("/api/admin/roles").send({ key: "auditor", name: "Auditor", permissions: [] })
    const updated = await request(app).patch("/api/admin/roles/role-2").send({ description: "Atualizado", permissions: ["autos.read"] })
    const permissions = await request(app).get("/api/admin/permissions")

    expect(roles.status).toBe(200)
    expect(created.status).toBe(201)
    expect(updated.status).toBe(200)
    expect(permissions.status).toBe(200)
    expect(permissions.body).toEqual({ permissions: [{ key: "autos.read", name: "Consultar autos", description: "" }] })
  })
})
