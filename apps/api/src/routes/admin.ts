import { Router, type Response } from "express"
import { hashPassword } from "../auth/password"
import { authenticateJwt, requirePermission } from "../auth/middleware"
import {
  AdminConflictError,
  AdminValidationError,
  createAdminRole,
  createAdminUser,
  listAdminPermissions,
  listAdminRoles,
  listAdminUsers,
  revokeAdminUserSessions,
  updateAdminRole,
  updateAdminUser,
} from "../auth/adminRepository"
import type { AuthRequest } from "../auth/types"

export const adminRouter = Router()
adminRouter.use("/api/admin", authenticateJwt)

function actorUserId(req: AuthRequest): string {
  return req.authUser?.id ?? ""
}

function sendAdminError(error: unknown, res: Response): void {
  if (error instanceof AdminConflictError) {
    res.status(409).json({ error: "Não é possível desativar o último administrador ativo" })
    return
  }
  if (error instanceof AdminValidationError) {
    res.status(400).json({ error: error.message })
    return
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    res.status(409).json({ error: "Registro já existe" })
    return
  }
  res.status(500).json({ error: "Não foi possível concluir a operação administrativa" })
}

function positiveInt(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new AdminValidationError(`${label} é obrigatório`)
  return value.trim()
}

function routeParam(value: string | string[], label: string): string {
  return requireText(Array.isArray(value) ? value[0] : value, label)
}

function normalizeEmail(value: unknown): string {
  const email = requireText(value, "E-mail").toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdminValidationError("E-mail inválido")
  return email
}

function readRoles(value: unknown, fallback?: string[]): string[] | undefined {
  if (value === undefined) return fallback
  if (!Array.isArray(value) || value.some((role) => typeof role !== "string" || !role.trim())) {
    throw new AdminValidationError("Roles inválidas")
  }
  return [...new Set(value.map((role) => role.trim()))]
}

function readPermissions(value: unknown, fallback?: string[]): string[] | undefined {
  if (value === undefined) return fallback
  if (!Array.isArray(value) || value.some((permission) => typeof permission !== "string" || !permission.trim())) {
    throw new AdminValidationError("Permissões inválidas")
  }
  return [...new Set(value.map((permission) => permission.trim()))]
}

adminRouter.get("/api/admin/users", requirePermission("users.read"), async (req, res) => {
  const page = positiveInt(req.query.page, 1)
  const pageSize = positiveInt(req.query.pageSize, 20)
  if (!page || !pageSize) {
    res.status(400).json({ error: "page e pageSize devem ser inteiros positivos" })
    return
  }

  try {
    const result = await listAdminUsers({
      search: typeof req.query.q === "string" ? req.query.q : "",
      page,
      pageSize: Math.min(100, pageSize),
    })
    res.json({ items: result.users, total: result.total, page, pageSize: Math.min(100, pageSize) })
  } catch (error) {
    sendAdminError(error, res)
  }
})

adminRouter.post("/api/admin/users", requirePermission("users.manage"), async (req, res) => {
  try {
    const password = requireText(req.body?.password, "Senha")
    if (password.length < 12) throw new AdminValidationError("A senha deve ter pelo menos 12 caracteres")
    const user = await createAdminUser({
      email: normalizeEmail(req.body?.email),
      fullName: requireText(req.body?.name, "Nome"),
      passwordHash: await hashPassword(password),
      roles: readRoles(req.body?.roles, ["consulta"]) ?? ["consulta"],
      actorUserId: actorUserId(req as AuthRequest),
    })
    res.status(201).json({ user })
  } catch (error) {
    sendAdminError(error, res)
  }
})

adminRouter.patch("/api/admin/users/:userId", requirePermission("users.manage"), async (req, res) => {
  try {
    const body = req.body ?? {}
    const input: Parameters<typeof updateAdminUser>[1] = {
      actorUserId: actorUserId(req as AuthRequest),
    }
    if (body.email !== undefined) input.email = normalizeEmail(body.email)
    if (body.name !== undefined) input.fullName = requireText(body.name, "Nome")
    if (body.password !== undefined) {
      const password = requireText(body.password, "Senha")
      if (password.length < 12) throw new AdminValidationError("A senha deve ter pelo menos 12 caracteres")
      input.passwordHash = await hashPassword(password)
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") throw new AdminValidationError("isActive deve ser booleano")
      input.isActive = body.isActive
    }
    if (body.roles !== undefined) input.roles = readRoles(body.roles) ?? []
    if (Object.keys(input).length === 1) throw new AdminValidationError("Nenhuma alteração informada")

    const user = await updateAdminUser(routeParam(req.params.userId, "Usuário"), input)
    res.json({ user })
  } catch (error) {
    sendAdminError(error, res)
  }
})

adminRouter.post("/api/admin/users/:userId/revoke-sessions", requirePermission("users.manage"), async (req, res) => {
  try {
    const revoked = await revokeAdminUserSessions(routeParam(req.params.userId, "Usuário"))
    res.json({ revoked })
  } catch (error) {
    sendAdminError(error, res)
  }
})

adminRouter.get("/api/admin/roles", requirePermission("roles.manage"), async (_req, res) => {
  try {
    res.json({ roles: await listAdminRoles() })
  } catch (error) {
    sendAdminError(error, res)
  }
})

adminRouter.post("/api/admin/roles", requirePermission("roles.manage"), async (req, res) => {
  try {
    const role = await createAdminRole({
      key: requireText(req.body?.key, "Chave da role"),
      name: requireText(req.body?.name, "Nome"),
      description: typeof req.body?.description === "string" ? req.body.description.trim() : "",
      permissions: readPermissions(req.body?.permissions, []) ?? [],
      actorUserId: actorUserId(req as AuthRequest),
    })
    res.status(201).json({ role })
  } catch (error) {
    sendAdminError(error, res)
  }
})

adminRouter.patch("/api/admin/roles/:roleId", requirePermission("roles.manage"), async (req, res) => {
  try {
    const body = req.body ?? {}
    const input: Parameters<typeof updateAdminRole>[1] = {
      actorUserId: actorUserId(req as AuthRequest),
    }
    if (body.key !== undefined) input.key = requireText(body.key, "Chave da role")
    if (body.name !== undefined) input.name = requireText(body.name, "Nome")
    if (body.description !== undefined) input.description = requireText(body.description, "Descrição")
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") throw new AdminValidationError("isActive deve ser booleano")
      input.isActive = body.isActive
    }
    if (body.permissions !== undefined) input.permissions = readPermissions(body.permissions) ?? []
    if (Object.keys(input).length === 1) throw new AdminValidationError("Nenhuma alteração informada")

    const role = await updateAdminRole(routeParam(req.params.roleId, "Role"), input)
    res.json({ role })
  } catch (error) {
    sendAdminError(error, res)
  }
})

adminRouter.get("/api/admin/permissions", requirePermission("roles.manage"), async (_req, res) => {
  try {
    res.json({ permissions: await listAdminPermissions() })
  } catch (error) {
    sendAdminError(error, res)
  }
})
