import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ThemeProvider, useTheme } from "./theme-provider"

function Probe() {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        toggle
      </button>
    </div>
  )
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
  })

  it("defaults to light and applies no dark class", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )
    expect(screen.getByTestId("theme")).toHaveTextContent("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("toggling to dark applies dark class and persists to localStorage", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )
    fireEvent.click(screen.getByText("toggle"))
    expect(screen.getByTestId("theme")).toHaveTextContent("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("theme")).toBe("dark")
  })
})
