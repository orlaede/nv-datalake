import type { ReactNode } from "react"
import { FiltersControls } from "@/components/dashboard/FiltersControls"
import { ThemeToggle } from "@/components/theme-toggle"
import { useFilters, formatPeriodoLabel } from "@/lib/use-filters"

// Cabeçalho padrão das páginas: título, período ativo, filtros e tema. `actions` entra antes do tema.
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  const { filters } = useFilters()
  const periodo = formatPeriodoLabel(filters)
  return (
    <div className="flex flex-row flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="shrink-0 text-2xl font-bold">{title}</h1>
        {periodo && <span className="text-sm text-muted-foreground">{periodo}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <FiltersControls />
        {actions}
        <ThemeToggle />
      </div>
    </div>
  )
}
