import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Pagination } from "./Pagination"

describe("Pagination", () => {
  it("disables first/previous on page 1 and next/last when on the last page", () => {
    render(
      <Pagination page={1} pageSize={25} total={30} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />
    )
    expect(screen.getByRole("button", { name: "Primeira página" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Próxima página" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Última página" })).not.toBeDisabled()
  })

  it("calls onPageChange with the last page when clicking 'Última página'", () => {
    const onPageChange = vi.fn()
    render(
      <Pagination page={1} pageSize={25} total={101} onPageChange={onPageChange} onPageSizeChange={vi.fn()} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Última página" }))
    expect(onPageChange).toHaveBeenCalledWith(5)
  })

  it("calls onPageChange with page - 1 / page + 1 for previous/next", () => {
    const onPageChange = vi.fn()
    render(
      <Pagination page={2} pageSize={25} total={100} onPageChange={onPageChange} onPageSizeChange={vi.fn()} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }))
    expect(onPageChange).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it("guards against a 0-page count when total is 0, disabling all navigation buttons", () => {
    render(
      <Pagination page={1} pageSize={25} total={0} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />
    )
    expect(screen.getByRole("button", { name: "Primeira página" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Última página" })).toBeDisabled()
    expect(screen.getByText("Página 1 de 1")).toBeInTheDocument()
  })
})
