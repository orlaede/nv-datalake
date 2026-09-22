import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FiltersControls } from "./FiltersControls"

function renderFiltersControls() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FiltersControls />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("FiltersControls", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ suggestions: [] }) })
    )
  })

  it("opens the filter drawer when Customizado is selected", async () => {
    renderFiltersControls()

    expect(screen.queryByLabelText("Início")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Customizado" }))

    expect(await screen.findByLabelText("Início")).toBeInTheDocument()
  })

  it("closes the drawer when Aplicar is clicked", async () => {
    renderFiltersControls()

    fireEvent.click(screen.getByRole("button", { name: "Customizado" }))
    expect(await screen.findByLabelText("Início")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }))

    expect(screen.queryByLabelText("Início")).not.toBeInTheDocument()
  })
})
