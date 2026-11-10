import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { BarChartStacked } from "./BarChartStacked"

describe("BarChartStacked", () => {
  it("renders one tick per category", () => {
    render(
      <BarChartStacked
        data={[
          { rotulo: "0-5", total: 10, a: 6, b: 4 },
          { rotulo: "6-10", total: 8, a: 2, b: 6 },
        ]}
        xKey="rotulo"
        series={[
          { key: "a", label: "A", color: "var(--chart-1)" },
          { key: "b", label: "B", color: "var(--warning)" },
        ]}
        totalKey="total"
        topColor={() => "var(--success)"}
      />
    )
    expect(screen.getAllByText("0-5").length).toBeGreaterThan(0)
    expect(screen.getAllByText("6-10").length).toBeGreaterThan(0)
  })
})
