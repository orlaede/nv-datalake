import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider, type AuthSession } from "@/lib/auth"
import { apiRequest } from "@/lib/api"
import { UsersAdmin } from "./UsersAdmin"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, apiRequest: vi.fn() }
})

const session: AuthSession = {
  accessToken: "token",
  user: {
    id: "admin-1",
    email: "admin@example.com",
    name: "Administrador",
    roles: ["admin"],
    permissions: ["users.read", "users.manage", "roles.manage"],
  },
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider initialSession={session}>
        <UsersAdmin />
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe("UsersAdmin", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders loading, empty and error states", async () => {
    let resolveList!: (value: unknown) => void
    vi.mocked(apiRequest).mockReturnValueOnce(new Promise((resolve) => { resolveList = resolve }))
    renderPage()
    expect(screen.getByText("Carregando usuários…")).toBeInTheDocument()
    resolveList({ items: [], total: 0, page: 1, pageSize: 20 })
    expect(await screen.findByText("Nenhum usuário encontrado.")).toBeInTheDocument()

    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Falha de rede"))
    fireEvent.change(screen.getByPlaceholderText("Buscar por nome ou e-mail"), { target: { value: "x" } })
    fireEvent.submit(screen.getByRole("form", { name: "Busca de usuários" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de rede")
  })

  it("creates users with roles and deactivates an existing user", async () => {
    const listedUser = {
      id: "user-1",
      name: "Usuário Teste",
      email: "user@example.com",
      isActive: true,
      roles: ["consulta"],
      permissions: ["autos.read"],
    }
    vi.mocked(apiRequest).mockResolvedValue({ items: [listedUser], total: 1, page: 1, pageSize: 20 })
    renderPage()
    expect(await screen.findByText("Usuário Teste")).toBeInTheDocument()

    vi.mocked(apiRequest).mockResolvedValueOnce({ user: listedUser })
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Novo Usuário" } })
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "novo@example.com" } })
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-segura-123" } })
    fireEvent.change(screen.getByLabelText("Roles"), { target: { value: "consulta, operador" } })
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/admin/users", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"roles":["consulta","operador"]'),
    })))

    vi.mocked(apiRequest).mockResolvedValueOnce({}).mockResolvedValueOnce({ revoked: 1 })
    fireEvent.click(screen.getByRole("button", { name: "Desativar Usuário Teste" }))
    expect(await screen.findByText("Sessões revogadas: 1")).toBeInTheDocument()
  })
})
