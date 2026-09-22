import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFilters } from "@/lib/use-filters"
import { cn } from "@/lib/utils"

const PERIOD_OPTIONS = ["Hoje", "Semana", "Mês", "Ano", "Customizado"] as const

type PeriodOption = (typeof PERIOD_OPTIONS)[number]

const OPTION_BY_PERIODO_DATA: Record<string, PeriodOption> = {
  hoje: "Hoje",
  semana: "Semana",
  mês: "Mês",
  ano: "Ano",
  customizado: "Customizado",
}

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getPresetRange(option: Exclude<PeriodOption, "Customizado">) {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)

  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 0, 0)

  if (option === "Semana") {
    const day = start.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + mondayOffset)
  }

  if (option === "Mês") {
    start.setDate(1)
  }

  if (option === "Ano") {
    start.setMonth(0, 1)
  }

  return {
    start: formatDateTimeLocal(start),
    end: formatDateTimeLocal(end),
  }
}

export function PeriodSelector({ onCustomSelected }: { onCustomSelected?: () => void }) {
  const { filters, setFilter, setFilters } = useFilters()
  const selected = OPTION_BY_PERIODO_DATA[filters.periodo_data ?? "hoje"] ?? "Hoje"

  function selectPeriod(option: PeriodOption) {
    const periodo_data = option === "Customizado" ? "customizado" : option.toLowerCase()
    if (option !== "Customizado") {
      const range = getPresetRange(option)
      setFilters({
        periodo_data,
        data_inicio: range.start,
        data_fim: range.end,
      })
      return
    }
    setFilter("periodo_data", periodo_data)
    onCustomSelected?.()
  }

  return (
    <div
      role="group"
      aria-label="Selecionar período"
      className="inline-flex h-8 items-center rounded-lg border border-border bg-card p-0.5 shadow-sm"
    >
      <CalendarDays className="mx-2 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      {PERIOD_OPTIONS.map((option) => {
        const active = selected === option
        return (
          <Button
            key={option}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={active}
            onClick={() => selectPeriod(option)}
            className={cn(
              "h-7 rounded-md px-2 text-xs",
              active
                ? "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {option}
          </Button>
        )
      })}
    </div>
  )
}
