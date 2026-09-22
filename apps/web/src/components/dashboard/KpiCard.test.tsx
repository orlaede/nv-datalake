import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { KpiCard } from "./KpiCard"

describe("KpiCard", () => {
  it("renders label, value and trend", () => {
    render(<KpiCard label="Total de Autos" value="1.234" trend="+3.2%" trendPositive />)
    expect(screen.getByText("Total de Autos")).toBeInTheDocument()
    expect(screen.getByText("1.234")).toBeInTheDocument()
    expect(screen.getByText("+3.2%")).toBeInTheDocument()
  })
})
