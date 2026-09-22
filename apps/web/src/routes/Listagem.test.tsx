import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/lib/theme-provider"
import { Listagem } from "./Listagem"

function renderListagem() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider>
          <Listagem />
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("Listagem", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: 1,
          page: 1,
          pageSize: 25,
          rows: [
            {
              id: 1,
              data_hora: "2026-06-12T08:15:00Z",
              agente: "Vanessa Cordeiro Celestino",
              local: "Rua Professor Genuino Sales",
              tipo: "Sem Abordagem",
              codigo: "7455",
              numero_auto: "998877",
              equipamento: "Radar 01",
              periodo: "Manhã",
              competencia: "Municipal",
              motivo_cancelamento: null,
              status: "Válido",
            },
          ],
        }),
      })
    )
  })

  it("renders fetched rows with every field and opens the filter drawer", async () => {
    renderListagem()
    expect(screen.getByRole("group", { name: "Selecionar período" })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText("Vanessa Cordeiro Celestino")).toBeInTheDocument())
    expect(screen.getByText("Rua Professor Genuino Sales")).toBeInTheDocument()
    expect(screen.getByText("Sem Abordagem")).toBeInTheDocument()
    expect(screen.getByText("745-5")).toBeInTheDocument()
    expect(screen.getByText("998877")).toBeInTheDocument()
    expect(screen.getByText("Radar 01")).toBeInTheDocument()
    expect(screen.getByText("Manhã")).toBeInTheDocument()
    expect(screen.getByText("Municipal")).toBeInTheDocument()

    expect(screen.queryByPlaceholderText("Agente de trânsito")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Abrir filtros" }))
    expect(await screen.findByPlaceholderText("Agente de trânsito")).toBeInTheDocument()
  })

  it("requests page and pageSize from the URL and passes total to the pagination controls", async () => {
    renderListagem()
    await waitFor(() => expect(screen.getByText("Vanessa Cordeiro Celestino")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled()

    const fetchMock = vi.mocked(fetch)
    const requestedUrl = fetchMock.mock.calls[0][0] as string
    expect(requestedUrl).toContain("page=1")
    expect(requestedUrl).toContain("pageSize=25")
  })
})
