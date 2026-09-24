import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { OrigemSelector } from "./OrigemSelector"

function renderOrigemSelector(initialEntry = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <OrigemSelector />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function mockOrigensFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ origens: ["Caucaia (Amostra)", "Quixadá"] }),
    })
  )
}

describe("OrigemSelector", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders Todas as origens by default when no origem param is set", async () => {
    mockOrigensFetch()
    renderOrigemSelector()

    const trigger = screen.getByRole("combobox", { name: "Origem dos dados" })
    expect(trigger).toBeInTheDocument()
    expect(await screen.findByText("Todas as origens")).toBeInTheDocument()
  })

  it("displays the origem selected via URL param", async () => {
    mockOrigensFetch()
    renderOrigemSelector("/?origem=Quixad%C3%A1")

    expect(await screen.findByText("Quixadá")).toBeInTheDocument()
  })
})
