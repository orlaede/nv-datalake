import { useSearchParams } from "react-router-dom"

export const FILTER_KEYS = [
  "agente",
  "local",
  "tipo",
  "codigo",
  "equipamento",
  "periodo",
  "periodo_data",
  "data_inicio",
  "data_fim",
  "competencia",
  "motivo_cancelamento",
] as const

export type FilterKey = (typeof FILTER_KEYS)[number]
export type Filters = Partial<Record<FilterKey, string>>

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getTodayRange() {
  const start = new Date()
  const end = new Date()

  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 0, 0)

  return {
    start: formatDateTimeLocal(start),
    end: formatDateTimeLocal(end),
  }
}

function formatDateTimeLabel(value: string) {
  const [datePart, timePart] = value.split("T")
  if (!datePart || !timePart) return value
  const [year, month, day] = datePart.split("-")
  return `${day}/${month}/${year} ${timePart}`
}

export function formatPeriodoLabel(filters: Filters) {
  if (!filters.data_inicio || !filters.data_fim) return null
  return `${formatDateTimeLabel(filters.data_inicio)} — ${formatDateTimeLabel(filters.data_fim)}`
}

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters: Filters = {}
  for (const key of FILTER_KEYS) {
    const value = searchParams.get(key)
    if (value) filters[key] = value
  }

  if (!filters.periodo_data && !filters.data_inicio && !filters.data_fim) {
    const today = getTodayRange()
    filters.periodo_data = "hoje"
    filters.data_inicio = today.start
    filters.data_fim = today.end
  }

  function setFilter(key: FilterKey, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    setSearchParams(next)
  }

  function setFilters(values: Partial<Record<FilterKey, string>>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(values) as [FilterKey, string | undefined][]) {
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
    }
    setSearchParams(next)
  }

  return { filters, setFilter, setFilters }
}
