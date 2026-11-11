import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/lib/theme-provider"
import { RetornosProcessamento } from "./RetornosProcessamento"

function renderPage(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <ThemeProvider>
          <Routes>
            <Route path="/processamento/retornos" element={<RetornosProcessamento />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("RetornosProcessamento", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: 1,
          rows: [
            {
              id: 1,
              data_hora: "2026-06-12T08:15:00Z",
              agente: "Vanessa Cordeiro Celestino",
              local: "Rua A",
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

  it("lista os autos do retorno escolhido, com colunas e sem agrupar/exportar", async () => {
    renderPage("/processamento/retornos?retorno=PLACA%20INV%C3%81LIDA")
    expect(screen.getByRole("heading", { name: "Retornos de Processamento" })).toBeInTheDocument()
    expect(screen.getByText("PLACA INVÁLIDA")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText("998877")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Colunas" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Agrupar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Exportar Excel" })).not.toBeInTheDocument()
    const url = vi
      .mocked(fetch)
      .mock.calls.map((c) => String(c[0]))
      .find((u) => u.includes("/api/processamento/retornos/autos"))
    expect(url).toContain("retorno=PLACA+INV%C3%81LIDA")
  })

  it("sem retorno escolhido não consulta a API", () => {
    renderPage("/processamento/retornos")
    expect(screen.getByText(/Selecione uma barra/)).toBeInTheDocument()
    const urls = vi.mocked(fetch).mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes("/api/processamento/retornos/autos"))).toBe(false)
  })
})
