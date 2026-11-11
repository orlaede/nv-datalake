import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/lib/theme-provider"
import { Processamento } from "./Processamento"

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/processamento"]}>
        <ThemeProvider>
          <Routes>
            <Route path="/processamento" element={<Processamento />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("Processamento", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          prazo: 30,
          totalAutos: 999,
          processados: 444,
          dentroPrazo: 777,
          foraPrazo: 555,
          faixas: [
            { rotulo: "0-30", de: 0, ate: 30, total: 120, dentroPrazo: true },
            { rotulo: "31+", de: 31, ate: null, total: 45, dentroPrazo: false },
          ],
        }),
      })
    )
  })

  it("renders title, KPIs and chart", async () => {
    renderPage()
    expect(screen.getByRole("heading", { name: "Processamento" })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText("777")).toBeInTheDocument())
    expect(screen.getByText("555")).toBeInTheDocument()
    expect(screen.getByText("999")).toBeInTheDocument()
    expect(screen.getByText("444")).toBeInTheDocument()
    expect(screen.getByText("Total de Autos")).toBeInTheDocument()
    expect(screen.getByText("Autos processados")).toBeInTheDocument()
    expect(screen.getByText("Pendentes dentro do prazo (≤ 30 dias)")).toBeInTheDocument()
    expect(screen.getByText("Pendentes fora do prazo (> 30 dias)")).toBeInTheDocument()
    expect(screen.getAllByText("0-30").length).toBeGreaterThan(0)
  })
})
