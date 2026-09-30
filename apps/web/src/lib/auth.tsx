import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { API_URL, refreshAuthSession, setAuthSession, type AuthSession, type AuthUser } from "./api"

export type { AuthSession, AuthUser } from "./api"

type AuthContextValue = {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children, initialSession }: { children: ReactNode; initialSession?: AuthSession | null }) {
  const [session, setSession] = useState<AuthSession | null>(initialSession ?? null)
  const [isLoading, setIsLoading] = useState(initialSession === undefined)

  useEffect(() => {
    if (initialSession !== undefined) {
      setAuthSession(initialSession)
      setSession(initialSession)
      setIsLoading(false)
      return
    }

    let active = true
    void refreshAuthSession()
      .then((nextSession) => {
        if (active) setSession(nextSession)
      })
      .catch(() => {
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [initialSession])

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const body = await response.json().catch(() => null) as (AuthSession & { error?: string }) | null
    if (!response.ok) throw new Error(body?.error ?? `Falha ao entrar (HTTP ${response.status})`)
    if (!body?.accessToken || !body?.user) throw new Error("Resposta de login inválida")
    setAuthSession(body)
    setSession(body)
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" })
    } finally {
      setAuthSession(null)
      setSession(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    accessToken: session?.accessToken ?? null,
    isLoading,
    login,
    logout,
    hasPermission: (permission: string) => Boolean(session?.user.permissions.includes(permission)),
  }), [isLoading, login, logout, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider")
  return context
}

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando sessão…</div>
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return <Outlet />
}

export function PermissionGate({ permission, children, fallback = null }: { permission: string; children: ReactNode; fallback?: ReactNode }) {
  return useAuth().hasPermission(permission) ? children : fallback
}
