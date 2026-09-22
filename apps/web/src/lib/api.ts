const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001"

export type AuthUser = {
  id: string
  email: string
  name: string
  roles: string[]
  permissions: string[]
}

export type AuthSession = {
  accessToken: string
  user: AuthUser
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

let accessToken: string | null = null
let refreshPromise: Promise<AuthSession> | null = null

export function setAuthSession(session: AuthSession | null): void {
  accessToken = session?.accessToken ?? null
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown }
    return typeof body.error === "string" ? body.error : `API error ${response.status}`
  } catch {
    return `API error ${response.status}`
  }
}

export async function refreshAuthSession(): Promise<AuthSession> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
    if (!response.ok) {
      accessToken = null
      throw new ApiError(response.status, await readError(response))
    }
    const session = await response.json() as AuthSession
    if (!session.accessToken || !session.user) throw new ApiError(500, "Resposta de sessão inválida")
    setAuthSession(session)
    return session
  })()
  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

export async function apiRequestResponse(
  path: string,
  init: RequestInit = {},
  retryRefresh = true
): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`)
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" })
  if (response.status === 401 && retryRefresh) {
    try {
      await refreshAuthSession()
      return apiRequestResponse(path, init, false)
    } catch {
      throw new ApiError(401, "Sessão expirada")
    }
  }
  return response
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiRequestResponse(path, init)
  if (!response.ok) throw new ApiError(response.status, await readError(response))
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function apiGet<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const query = search.toString()
  const url = `${API_URL}${path}${query ? `?${query}` : ""}`
  return apiRequest<T>(url.replace(API_URL, ""))
}

export { API_URL }
