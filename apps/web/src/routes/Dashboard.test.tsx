import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/lib/theme-provider"
import { Dashboard } from "./Dashboard"

function renderDashboard() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/?agente=Vanessa"]}>
        <ThemeProvider>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/autos" element={<div>Listagem de Autos de Infração</div>} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: 363,
          porAgente: [{ agente: "Agente 001", total: "27" }],
          porMotivoCancelamento: [{ motivo_cancelamento: "Erro de digitação", total: "12" }],
          numAgentes: 4,
          numEquipamentos: 6,
          serieTemporal: [
            { bucket: "seg", total: 10 },
            { bucket: "ter", total: 0 },
          ],
          porTipo: [{ tipo: "Sem Abordagem", total: "300" }],
          porCompetencia: [{ competencia: "Municipal", total: "200" }],
          porMesComparativo: [{ mes: "Jul/26", atual: 300, anterior: 250 }],
        }),
      })
    )
  })

  it("renders the 3 KPI cards, the line chart and the two bar charts", async () => {
    renderDashboard()
    expect(screen.getByRole("group", { name: "Selecionar período" })).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText("363")).toBeInTheDocument())
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("6", { selector: "div.text-2xl" })).toBeInTheDocument()
    expect(screen.getByText("Total de Autos")).toBeInTheDocument()
    expect(screen.getByText("Número de Agentes")).toBeInTheDocument()
    expect(screen.getByText("Número de Equipamentos")).toBeInTheDocument()

    expect(screen.getByText("Evolução de Autos")).toBeInTheDocument()
    expect(screen.getByText("Autos por Tipo")).toBeInTheDocument()
    expect(screen.getByText("Autos por Competência")).toBeInTheDocument()
    expect(screen.getByText("Autos por Mês")).toBeInTheDocument()

    expect(screen.queryByText("Top agentes")).not.toBeInTheDocument()
    expect(screen.queryByText("Distribuição por motivo de cancelamento")).not.toBeInTheDocument()
  })

  it("navigates to /autos preserving the current filters when clicking Mostrar Dados", async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText("363")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: "Mostrar Dados" }))
    expect(await screen.findByText("Listagem de Autos de Infração")).toBeInTheDocument()
  })
})
