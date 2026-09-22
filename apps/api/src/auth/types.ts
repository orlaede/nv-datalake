import type { Request } from "express"

export type AuthUserRecord = {
  userId: string
  email: string
  fullName: string
  isActive: boolean
  roles: string[]
  permissions: string[]
  passwordHash?: string
}

export type RefreshTokenRecord = {
  tokenId: string
  userId: string
  tokenHash: string
  expiresAt: Date | string
  revokedAt: Date | string | null
  isActive: boolean
}

export type PublicUser = {
  id: string
  email: string
  name: string
  roles: string[]
  permissions: string[]
}

export type AuthRequest = Request & {
  authUser?: PublicUser
}

export type AuthContext = {
  ipAddress?: string
  userAgent?: string
}

export function toPublicUser(user: AuthUserRecord): PublicUser {
  return {
    id: user.userId,
    email: user.email,
    name: user.fullName,
    roles: user.roles,
    permissions: user.permissions,
  }
}
