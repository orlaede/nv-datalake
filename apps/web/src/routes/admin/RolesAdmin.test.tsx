import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider, type AuthSession } from "@/lib/auth"
import { apiRequest } from "@/lib/api"
import { RolesAdmin } from "./RolesAdmin"

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
    permissions: ["roles.manage"],
  },
}

describe("RolesAdmin", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lists permissions and creates a role with selected permissions", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ roles: [] })
      .mockResolvedValueOnce({ permissions: [{ key: "autos.read", name: "Consultar autos", description: "" }] })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider initialSession={session}><RolesAdmin /></AuthProvider>
      </QueryClientProvider>
    )

    expect(await screen.findByText("Nenhuma role encontrada.")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Chave"), { target: { value: "auditor" } })
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Auditor" } })
    fireEvent.click(screen.getByLabelText("Consultar autos"))
    fireEvent.click(screen.getByRole("button", { name: "Criar role" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/admin/roles", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"permissions":["autos.read"]'),
    })))
  })
})
