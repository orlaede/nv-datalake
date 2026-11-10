import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { BarChartStacked } from "./BarChartStacked"

describe("BarChartStacked", () => {
  it("renders one tick per faixa", () => {
    render(
      <BarChartStacked
        data={[
          { rotulo: "0-5", total: 10, processados: 6, pendentes: 4, dentroPrazo: true },
          { rotulo: "6-10", total: 8, processados: 2, pendentes: 6, dentroPrazo: false },
        ]}
      />
    )
    expect(screen.getAllByText("0-5").length).toBeGreaterThan(0)
    expect(screen.getAllByText("6-10").length).toBeGreaterThan(0)
  })
})
