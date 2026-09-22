export type Granularity = "hora" | "diaSemana" | "dia" | "mes"

const WEEKDAY_LABELS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]

function daysBetween(inicio: string, fim: string): number {
  const start = new Date(inicio)
  const end = new Date(fim)
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

export function resolveGranularity(
  periodoData: string | undefined,
  dataInicio: string | undefined,
  dataFim: string | undefined
): Granularity {
  if (periodoData === "hoje") return "hora"
  if (periodoData === "semana") return "diaSemana"
  if (periodoData === "mês") return "dia"
  if (periodoData === "ano") return "mes"

  if (dataInicio && dataFim) {
    return daysBetween(dataInicio, dataFim) <= 31 ? "dia" : "mes"
  }
  return "dia"
}

export function bucketSqlExpression(granularity: Granularity): string {
  switch (granularity) {
    case "hora":
      return `EXTRACT(HOUR FROM "Data e Hora")`
    case "diaSemana":
      return `EXTRACT(ISODOW FROM "Data e Hora")`
    case "dia":
      return `to_char("Data e Hora", 'YYYY-MM-DD')`
    case "mes":
      return `to_char("Data e Hora", 'YYYY-MM')`
  }
}

export function formatBucketKey(granularity: Granularity, raw: string | number): string {
  if (granularity === "hora") return String(raw).padStart(2, "0")
  if (granularity === "diaSemana") return WEEKDAY_LABELS[Number(raw) - 1]
  return String(raw)
}

export function generateBuckets(
  granularity: Granularity,
  dataInicio: string | undefined,
  dataFim: string | undefined
): string[] {
  if (granularity === "hora") {
    return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
  }
  if (granularity === "diaSemana") {
    return [...WEEKDAY_LABELS]
  }
  if (!dataInicio || !dataFim) return []

  if (granularity === "dia") {
    const buckets: string[] = []
    const cursor = new Date(dataInicio)
    cursor.setHours(0, 0, 0, 0)
    const end = new Date(dataFim)
    end.setHours(0, 0, 0, 0)
    while (cursor.getTime() <= end.getTime()) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, "0")
      const d = String(cursor.getDate()).padStart(2, "0")
      buckets.push(`${y}-${m}-${d}`)
      cursor.setDate(cursor.getDate() + 1)
    }
    return buckets
  }

  const buckets: string[] = []
  const cursor = new Date(dataInicio)
  cursor.setDate(1)
  const end = new Date(dataFim)
  end.setDate(1)
  while (cursor.getTime() <= end.getTime()) {
    buckets.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return buckets
}
