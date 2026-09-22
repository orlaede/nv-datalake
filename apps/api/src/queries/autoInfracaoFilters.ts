export type AutoInfracaoFilters = {
  agente?: string
  local?: string
  tipo?: string
  codigo?: string
  equipamento?: string
  periodo?: string
  data_inicio?: string
  data_fim?: string
  competencia?: string
  motivo_cancelamento?: string
}

type ConditionBuilder = (paramIndex: number) => string

const CONDITION_BY_FILTER: Record<keyof AutoInfracaoFilters, ConditionBuilder> = {
  agente: (i) => `"Nome do Agente" ILIKE $${i}`,
  local: (i) => `"Logradouro" ILIKE $${i}`,
  tipo: (i) => `"Tipo Infração" = $${i}`,
  codigo: (i) => `"Código da Infração"::text = $${i}`,
  equipamento: (i) => `"Equipamento" ILIKE $${i}`,
  periodo: (i) => `"Turno" = $${i}`,
  data_inicio: (i) => `"Data e Hora" >= $${i}`,
  data_fim: (i) => `"Data e Hora" <= $${i}`,
  competencia: (i) => `"Competência" = $${i}`,
  motivo_cancelamento: (i) =>
    `COALESCE("Justificativa do Cancelamento pelo Agente", "Justificativa do Cancelamento pelo Gestor") ILIKE $${i}`,
}

const LIKE_FILTERS: Partial<Record<keyof AutoInfracaoFilters, true>> = {
  agente: true,
  local: true,
  equipamento: true,
  motivo_cancelamento: true,
}

export function buildAutoInfracaoWhere(filters: AutoInfracaoFilters) {
  const conditions: string[] = []
  const params: string[] = []

  for (const [key, buildCondition] of Object.entries(CONDITION_BY_FILTER) as [
    keyof AutoInfracaoFilters,
    ConditionBuilder,
  ][]) {
    const value = filters[key]
    if (!value) continue
    params.push(LIKE_FILTERS[key] ? `%${value}%` : value)
    conditions.push(buildCondition(params.length))
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  }
}
