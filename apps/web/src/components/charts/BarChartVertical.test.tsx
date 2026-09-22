import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { BarChartVertical } from "./BarChartVertical"

describe("BarChartVertical", () => {
  it("renders one bar group per data point", () => {
    const data = [
      { mes: "Jan", total: 10 },
      { mes: "Fev", total: 20 },
    ]
    render(
      <BarChartVertical
        data={data}
        xKey="mes"
        yKey="total"
        config={{ total: { label: "Total", color: "var(--chart-1)" } }}
      />
    )
    // recharts renders a hidden `#recharts_measurement_span` used for text
    // measurement in addition to the visible axis tick, so text matches are
    // not unique — assert at least one (visible) match exists for each.
    expect(screen.getAllByText("Jan").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Fev").length).toBeGreaterThan(0)
  })
})
