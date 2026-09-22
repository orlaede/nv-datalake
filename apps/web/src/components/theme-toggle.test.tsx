import { describe, it, expect, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ThemeProvider } from "@/lib/theme-provider"
import { ThemeToggle } from "./theme-toggle"

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  )
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
  })

  it("shows the moon and offers to activate dark mode in light theme", () => {
    renderToggle()

    const button = screen.getByRole("button", { name: "Ativar modo escuro" })
    expect(button.querySelector("svg.lucide-moon")).toBeInTheDocument()
    expect(button.querySelector("svg.lucide-sun")).not.toBeInTheDocument()
  })

  it("switches to dark theme and then offers to activate light mode", () => {
    renderToggle()

    fireEvent.click(screen.getByRole("button", { name: "Ativar modo escuro" }))

    const button = screen.getByRole("button", { name: "Ativar modo claro" })
    expect(button.querySelector("svg.lucide-sun")).toBeInTheDocument()
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("theme")).toBe("dark")
  })
})
