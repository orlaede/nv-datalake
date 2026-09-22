import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, useSearchParams } from "react-router-dom"
import { PeriodSelector } from "./PeriodSelector"

function renderPeriodSelector(onCustomSelected?: () => void) {
  function Probe() {
    const [searchParams] = useSearchParams()
    return <output aria-label="query">{searchParams.toString()}</output>
  }

  return render(
    <MemoryRouter>
      <PeriodSelector onCustomSelected={onCustomSelected} />
      <Probe />
    </MemoryRouter>
  )
}

describe("PeriodSelector", () => {
  it("shows standard period options", () => {
    renderPeriodSelector()

    expect(screen.getByRole("group", { name: "Selecionar período" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Semana" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mês" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ano" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Customizado" })).toBeInTheDocument()
  })

  it("marks Customizado as selected and writes periodo_data to URL filters", () => {
    renderPeriodSelector()

    fireEvent.click(screen.getByRole("button", { name: "Customizado" }))

    expect(screen.getByRole("button", { name: "Customizado" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByLabelText("query")).toHaveTextContent("periodo_data=customizado")
  })

  it("calls onCustomSelected when Customizado is clicked", () => {
    const onCustomSelected = vi.fn()
    renderPeriodSelector(onCustomSelected)

    fireEvent.click(screen.getByRole("button", { name: "Customizado" }))

    expect(onCustomSelected).toHaveBeenCalledTimes(1)
  })

  it("does not call onCustomSelected when a standard period is clicked", () => {
    const onCustomSelected = vi.fn()
    renderPeriodSelector(onCustomSelected)

    fireEvent.click(screen.getByRole("button", { name: "Semana" }))

    expect(onCustomSelected).not.toHaveBeenCalled()
  })
})
