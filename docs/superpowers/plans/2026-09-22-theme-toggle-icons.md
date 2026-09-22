# Ícones de alternância de tema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the theme switch with a compact Moon/Sun icon button while preserving theme persistence and accessibility.

**Architecture:** Keep `ThemeProvider` as the source of truth. `ThemeToggle` will derive the icon and accessible label from the current theme and call the existing `setTheme` function with the opposite theme. No routes, API calls, or global theme CSS change.

**Tech Stack:** React, TypeScript, `lucide-react`, the existing local `Button`, Vitest, Testing Library.

---

### Task 1: Cover the icon toggle behavior with tests

**Files:**
- Create: `apps/web/src/components/theme-toggle.test.tsx`
- Test: `apps/web/src/components/theme-toggle.test.tsx`

- [ ] **Step 1: Write the failing tests**

Render `ThemeToggle` inside `ThemeProvider`, clear `localStorage` and the root `dark` class before each test, then assert that the light state exposes the Moon icon and dark-mode action label. Click it and assert the dark state exposes the Sun icon and light-mode action label.

```tsx
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
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `apps/web/node_modules/.bin/vitest run src/components/theme-toggle.test.tsx` from `apps/web`.

Expected: FAIL because `ThemeToggle` currently renders a `Switch`, not a button with Moon/Sun icons.

### Task 2: Replace the switch with the icon button

**Files:**
- Modify: `apps/web/src/components/theme-toggle.tsx`

- [ ] **Step 1: Implement the minimal component change**

Import `Moon` and `Sun` from `lucide-react`, import the existing `Button`, derive `isDark`, and render the opposite-theme icon with the matching accessible label.

```tsx
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/lib/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}
```

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `apps/web/node_modules/.bin/vitest run src/components/theme-toggle.test.tsx` from `apps/web`.

Expected: PASS with 2 tests.

### Task 3: Run the complete web verification

**Files:**
- Modify: none

- [ ] **Step 1: Run all web tests**

Run: `npm test` from `apps/web`.

Expected: all existing web tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build` from `apps/web`.

Expected: TypeScript compilation and Vite production build complete successfully.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check` and `git status --short` from the repository root.

Expected: no whitespace errors; only the intended component/test changes remain unstaged, aside from the already committed design and plan documents.
