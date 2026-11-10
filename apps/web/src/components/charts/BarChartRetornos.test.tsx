import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { BarChartRetornos } from "./BarChartRetornos"

describe("BarChartRetornos", () => {
  it("renderiza sem dados e com dados", () => {
    const { container, rerender } = render(<BarChartRetornos data={[]} />)
    expect(container.firstChild).toBeTruthy()
    rerender(<BarChartRetornos data={[{ tipo: "Sucesso", total: 3 }]} />)
    expect(container.firstChild).toBeTruthy()
  })
})
