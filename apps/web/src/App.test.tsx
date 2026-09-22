import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/lib/theme-provider"
import App from "./App"

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
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    )
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument()
  })

  it("renders a collapsible sidebar with dashboard and listing navigation", () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    )

    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Listagem" })).toHaveAttribute("href", "/autos")

    fireEvent.click(screen.getByRole("button", { name: "Recolher menu lateral" }))

    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Expandir menu lateral" })).toBeInTheDocument()
  })
})
