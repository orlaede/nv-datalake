import type { NextFunction, Request, Response } from "express"
import { getAuthConfig } from "./config"
import { loadUserById } from "./repository"
import { verifyAccessToken } from "./tokens"
import { toPublicUser, type AuthRequest } from "./types"

export async function authenticateJwt(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authorization = req.get("authorization")
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : ""
  if (!token) {
    res.status(401).json({ error: "Autenticação necessária" })
    return
  }

  try {
    const claims = await verifyAccessToken(token, getAuthConfig())
    const user = await loadUserById(claims.sub)
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Sessão inválida" })
      return
    }

    ;(req as AuthRequest).authUser = toPublicUser(user)
    next()
  } catch {
    res.status(401).json({ error: "Sessão inválida" })
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).authUser
    if (!user) {
      res.status(401).json({ error: "Autenticação necessária" })
      return
    }
    if (!user.permissions.includes(permission)) {
      res.status(403).json({ error: "Permissão insuficiente" })
      return
    }
    next()
  }
}
