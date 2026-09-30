import { beforeEach, describe, expect, it, vi } from "vitest"
import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { AuthProvider, PermissionGate, ProtectedRoute, useAuth, type AuthSession } from "./auth"
import { apiGet } from "./api"

const user = {
  id: "user-1",
  email: "user@example.com",
  name: "Usuário Teste",
  roles: ["operador"],
  permissions: ["dashboard.read", "autos.read"],
}

const session: AuthSession = { accessToken: "access-token", user }

function AuthProbe() {
  const { user: currentUser, login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <span>{currentUser?.email ?? "sem sessão"}</span>
      <span>{error ?? "sem erro"}</span>
      <button type="button" onClick={() => void login("user@example.com", "secret").catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))}>Entrar</button>
    </>
  )
}

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 401) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

describe("web auth client", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("refreshes the session when the provider loads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ accessToken: "refreshed", user }))
    vi.stubGlobal("fetch", fetchMock)

    render(
      <AuthProvider initialSession={undefined}>
        <AuthProbe />
      </AuthProvider>
    )

    expect(await screen.findByText(user.email)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/refresh"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    )
  })

  it("logs in with the API response and retries one protected request after 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ accessToken: "login-token", user }))
      .mockResolvedValueOnce(jsonResponse({ error: "expired" }, false, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "rotated-token", user }))
      .mockResolvedValueOnce(jsonResponse({ value: "ok" }))
    vi.stubGlobal("fetch", fetchMock)

    render(
      <AuthProvider initialSession={null}>
        <AuthProbe />
      </AuthProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }))
    expect(await screen.findByText(user.email)).toBeInTheDocument()
    await expect(apiGet<{ value: string }>("/protected", {})).resolves.toEqual({ value: "ok" })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({ method: "POST" }))
    expect(new Headers(fetchMock.mock.calls[3][1]?.headers).get("Authorization")).toBe("Bearer rotated-token")
  })

  it("mostra erro legível quando a resposta não é JSON", async () => {
    const htmlResponse = {
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON')
      },
      text: async () => "<!DOCTYPE html><html lang=\"en\"><title>Error</title>",
    }
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse)
    vi.stubGlobal("fetch", fetchMock)

    render(
      <AuthProvider initialSession={null}>
        <AuthProbe />
      </AuthProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }))
    const message = await screen.findByText(/Falha ao entrar/)
    expect(message).toHaveTextContent("500")
  })

  it("redirects unauthenticated users and hides unavailable permissions", async () => {
    render(
      <AuthProvider initialSession={null}>
        <MemoryRouter initialEntries={["/private"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/private" element={<div>privado</div>} />
            </Route>
            <Route path="/login" element={<div>login</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )
    expect(await screen.findByText("login")).toBeInTheDocument()

    render(
      <AuthProvider initialSession={session}>
        <PermissionGate permission="users.manage">
          <div>admin</div>
        </PermissionGate>
      </AuthProvider>
    )
    await waitFor(() => expect(screen.queryByText("admin")).not.toBeInTheDocument())
  })
})
