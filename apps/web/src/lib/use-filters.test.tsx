import { afterEach, describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { useFilters } from "./use-filters"

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter initialEntries={["/?agente=123&periodo=turno%3Amanha"]}>{children}</MemoryRouter>
}

function emptyWrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe("useFilters", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("reads filters from the URL", () => {
    const { result } = renderHook(() => useFilters(), { wrapper })
    expect(result.current.filters.agente).toBe("123")
    expect(result.current.filters.periodo).toBe("turno:manha")
    expect(result.current.filters.local).toBeUndefined()
  })

  it("setFilter updates a single field without dropping others", () => {
    const { result } = renderHook(() => useFilters(), { wrapper })
    act(() => {
      result.current.setFilter("local", "centro")
    })
    expect(result.current.filters.agente).toBe("123")
    expect(result.current.filters.local).toBe("centro")
  })

  it("setFilter with empty string removes the param", () => {
    const { result } = renderHook(() => useFilters(), { wrapper })
    act(() => {
      result.current.setFilter("agente", "")
    })
    expect(result.current.filters.agente).toBeUndefined()
  })

  it("setFilters updates multiple fields without dropping existing params", () => {
    const { result } = renderHook(() => useFilters(), { wrapper })
    act(() => {
      result.current.setFilters({
        periodo_data: "customizado",
        data_inicio: "2026-06-01T08:30",
        data_fim: "2026-06-30T18:45",
      })
    })
    expect(result.current.filters.agente).toBe("123")
    expect(result.current.filters.periodo_data).toBe("customizado")
    expect(result.current.filters.data_inicio).toBe("2026-06-01T08:30")
    expect(result.current.filters.data_fim).toBe("2026-06-30T18:45")
  })

  it("defaults to today's date range when no period filter is present", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-04T12:00:00"))

    const { result } = renderHook(() => useFilters(), { wrapper: emptyWrapper })

    expect(result.current.filters.periodo_data).toBe("hoje")
    expect(result.current.filters.data_inicio).toBe("2026-07-04T00:00")
    expect(result.current.filters.data_fim).toBe("2026-07-04T23:59")
  })
})
