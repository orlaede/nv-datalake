import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactElement } from "react"
import { DataTable } from "./DataTable"

const baseRow = {
  id: 1,
  dataHora: "2026-06-12T08:15:00Z",
  agente: "Vanessa Cordeiro Celestino",
  local: "Rua Professor Genuino Sales",
  tipo: "Sem Abordagem",
  codigo: "7455",
  numeroAuto: "998877",
  equipamento: "Radar 01",
  periodo: "Manhã",
  competencia: "Municipal",
  motivoCancelamento: null,
  status: "Válido",
}

function renderTable(element: ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {element}
    </QueryClientProvider>
  )
}

describe("DataTable", () => {
  it("uses semantic badge colors based on the real Status do Auto value", () => {
    renderTable(
      <DataTable
        rows={[
          baseRow,
          {
            ...baseRow,
            id: 2,
            agente: "Carlos Freitas",
            tipo: "Com Abordagem",
            motivoCancelamento: "Erro de digitação",
            status: "Cancelado",
          },
        ]}
        page={1}
        pageSize={25}
        total={2}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        filters={{}}
      />
    )

    expect(screen.getByText("Válido")).toHaveAttribute("data-variant", "success")
    expect(screen.getByText("Cancelado")).toHaveAttribute("data-variant", "destructive")
  })

  it("renders every field as a column", () => {
    renderTable(
      <DataTable
        rows={[baseRow]}
        page={1}
        pageSize={25}
        total={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        filters={{}}
      />
    )

    expect(screen.getByText("745-5")).toBeInTheDocument()
    expect(screen.getByText("998877")).toBeInTheDocument()
    expect(screen.getByText("Radar 01")).toBeInTheDocument()
    expect(screen.getByText("Manhã")).toBeInTheDocument()
    expect(screen.getByText("Municipal")).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("wires the pagination controls", () => {
    const onPageChange = vi.fn()
    renderTable(
      <DataTable
        rows={[baseRow]}
        page={1}
        pageSize={25}
        total={100}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
        filters={{}}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})
