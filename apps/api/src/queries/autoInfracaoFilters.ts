import {
  AGENTE_EXPR,
  CODIGO_EXPR,
  COMPETENCIA_EXPR,
  DATA_HORA_EXPR,
  EQUIPAMENTO_EXPR,
  LOCAL_EXPR,
  MOTIVO_CANCELAMENTO_EXPR,
  ORIGEM_EXPR,
  PERIODO_EXPR,
  TIPO_EXPR,
} from "./goldStarExpressions"

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
  origem?: string
}

type ConditionBuilder = (paramIndex: number) => string

const CONDITION_BY_FILTER: Record<keyof AutoInfracaoFilters, ConditionBuilder> = {
  agente: (i) => `${AGENTE_EXPR} ILIKE $${i}`,
  local: (i) => `${LOCAL_EXPR} ILIKE $${i}`,
  tipo: (i) => `${TIPO_EXPR} = $${i}`,
  codigo: (i) => `${CODIGO_EXPR} = $${i}`,
  equipamento: (i) => `${EQUIPAMENTO_EXPR} ILIKE $${i}`,
  periodo: (i) => `${PERIODO_EXPR} = $${i}`,
  data_inicio: (i) => `${DATA_HORA_EXPR} >= $${i}`,
  data_fim: (i) => `${DATA_HORA_EXPR} <= $${i}`,
  competencia: (i) => `${COMPETENCIA_EXPR} = $${i}`,
  motivo_cancelamento: (i) => `${MOTIVO_CANCELAMENTO_EXPR} ILIKE $${i}`,
  origem: (i) => `${ORIGEM_EXPR} = $${i}`,
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
