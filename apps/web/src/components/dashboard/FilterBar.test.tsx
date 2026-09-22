import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FilterBar } from "./FilterBar"

function LocationSearch() {
  const location = useLocation()
  return <output aria-label="Busca atual">{location.search}</output>
}

function renderFilterBar(initialEntry = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <FilterBar />
        <LocationSearch />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("FilterBar", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ suggestions: ["Vanessa Cordeiro Celestino"] }),
      })
    )
  })

  it("fetches suggestions after 3 characters and applies filter only when a suggestion is selected", async () => {
    renderFilterBar()

    const agente = screen.getByPlaceholderText("Agente de trânsito")
    fireEvent.change(agente, { target: { value: "Va" } })

    expect(fetch).not.toHaveBeenCalled()

    fireEvent.change(agente, { target: { value: "Van" } })

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain(
      "/api/autos-infracao/suggestions?field=agente&q=Van"
    )
    expect(screen.getByLabelText("Busca atual")).toHaveTextContent("")

    const suggestion = await screen.findByRole("option", { name: "Vanessa Cordeiro Celestino" })
    fireEvent.mouseDown(suggestion)

    expect(screen.getByLabelText("Busca atual")).toHaveTextContent(
      "?agente=Vanessa+Cordeiro+Celestino"
    )
  })

  it.each([
    "Agente de trânsito",
    "Código da infração",
    "Equipamento",
    "Motivo de cancelamento",
  ])("renders %s as autocomplete combobox", (placeholder) => {
    renderFilterBar()

    expect(screen.getByPlaceholderText(placeholder)).toHaveAttribute("role", "combobox")
  })

  it("clears all URL filters when the last text filter is cleared", () => {
    renderFilterBar("/?agente=Maria&periodo_data=ano&data_inicio=2026-01-01T00%3A00&data_fim=2026-07-04T23%3A59")

    fireEvent.change(screen.getByPlaceholderText("Agente de trânsito"), { target: { value: "" } })

    expect(screen.getByLabelText("Busca atual")).toBeEmptyDOMElement()
  })

  it("hides the custom date range fields when period is not customizado", () => {
    renderFilterBar("/?periodo_data=ano")

    expect(screen.queryByLabelText("Início")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Fim")).not.toBeInTheDocument()
  })

  it("shows and writes the custom date range fields when period is customizado", () => {
    renderFilterBar("/?periodo_data=customizado")

    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-06-01T08:30" } })
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-06-30T18:45" } })

    expect(screen.getByLabelText("Busca atual")).toHaveTextContent("data_inicio=2026-06-01T08%3A30")
    expect(screen.getByLabelText("Busca atual")).toHaveTextContent("data_fim=2026-06-30T18%3A45")
  })
})
