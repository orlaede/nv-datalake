import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { AuthProvider } from "@/lib/auth"
import { Login } from "./Login"

function response(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 401, json: async () => body, text: async () => JSON.stringify(body) }
}

describe("Login", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("submits e-mail and password and navigates to the requested route", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      accessToken: "access-token",
      user: { id: "user-1", email: "user@example.com", name: "Usuário", roles: ["admin"], permissions: [] },
    })))

    render(
      <AuthProvider initialSession={null}>
        <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: "/autos" } }]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/autos" element={<div>autos protegidos</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "user@example.com" } })
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "secret" } })
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("autos protegidos")).toBeInTheDocument()
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/login"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    )
  })

  it("shows the server error without exposing implementation details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "Credenciais inválidas" }, false)))

    render(
      <AuthProvider initialSession={null}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes><Route path="/login" element={<Login />} /></Routes>
        </MemoryRouter>
      </AuthProvider>
    )

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "wrong@example.com" } })
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "wrong-password" } })
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Credenciais inválidas"))
  })
})
