import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { usePagination } from "./use-pagination"

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter initialEntries={["/autos"]}>{children}</MemoryRouter>
}

describe("usePagination", () => {
  it("defaults to page 1 and pageSize 25", () => {
    const { result } = renderHook(() => usePagination(), { wrapper })
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(25)
  })

  it("updates the page", () => {
    const { result } = renderHook(() => usePagination(), { wrapper })
    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)
  })

  it("updates pageSize and resets page to 1", () => {
    const { result } = renderHook(() => usePagination(), { wrapper })
    act(() => result.current.setPage(3))
    act(() => result.current.setPageSize(50))
    expect(result.current.pageSize).toBe(50)
    expect(result.current.page).toBe(1)
  })
})
