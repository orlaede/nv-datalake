import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/lib/theme-provider"
import { AuthProvider, type AuthSession } from "@/lib/auth"
import App from "./App"

const session: AuthSession = {
  accessToken: "test-token",
  user: {
    id: "user-1",
    email: "user@example.com",
    name: "Usuário Teste",
    roles: ["admin"],
    permissions: ["dashboard.read", "autos.read", "autos.export", "users.read", "users.manage", "roles.manage"],
  },
}

function renderApp() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider initialSession={session}>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: 0,
          porMotivoCancelamento: [],
        }),
      })
    )
  })

  it("renders the dashboard route by default", () => {
    renderApp()
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument()
  })

  it("renders a collapsible sidebar with dashboard and listing navigation", () => {
    renderApp()

    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Abrir Dashboard" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Abrir Listagem" })).toHaveAttribute("href", "/autos")

    fireEvent.click(screen.getByRole("button", { name: "Expandir menu lateral" }))

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Recolher menu lateral" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Configurações" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Usuários" })).toHaveAttribute("href", "/admin/usuarios")
    expect(screen.getByRole("link", { name: "Roles" })).toHaveAttribute("href", "/admin/roles")
  })
})
