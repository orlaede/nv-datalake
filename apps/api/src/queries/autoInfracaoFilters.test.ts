import { describe, it, expect } from "vitest"
import { buildAutoInfracaoWhere } from "./autoInfracaoFilters"
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

describe("buildAutoInfracaoWhere", () => {
  it("returns empty clause and no params when no filters given", () => {
    const { clause, params } = buildAutoInfracaoWhere({})
    expect(clause).toBe("")
    expect(params).toEqual([])
  })

  it("builds an ILIKE clause with wildcards for free-text filters", () => {
    const { clause, params } = buildAutoInfracaoWhere({ agente: "vanessa" })
    expect(clause).toBe(`WHERE ${AGENTE_EXPR} ILIKE $1`)
    expect(params).toEqual(["%vanessa%"])
  })

  it("builds an equality clause for enum-like filters", () => {
    const { clause, params } = buildAutoInfracaoWhere({ periodo: "Manhã" })
    expect(clause).toBe(`WHERE ${PERIODO_EXPR} = $1`)
    expect(params).toEqual(["Manhã"])
  })

  it("casts codigo to text for comparison", () => {
    const { clause, params } = buildAutoInfracaoWhere({ codigo: "57380" })
    expect(clause).toBe(`WHERE ${CODIGO_EXPR} = $1`)
    expect(params).toEqual(["57380"])
  })

  it("filters by tipo with the abordagem case expression", () => {
    const { clause, params } = buildAutoInfracaoWhere({ tipo: "Com Abordagem" })
    expect(clause).toBe(`WHERE ${TIPO_EXPR} = $1`)
    expect(params).toEqual(["Com Abordagem"])
  })

  it("filters by local and equipamento with ILIKE", () => {
    const { clause, params } = buildAutoInfracaoWhere({ local: "Rua A", equipamento: "Radar" })
    expect(clause).toBe(`WHERE ${LOCAL_EXPR} ILIKE $1 AND ${EQUIPAMENTO_EXPR} ILIKE $2`)
    expect(params).toEqual(["%Rua A%", "%Radar%"])
  })

  it("coalesces both cancellation justification columns for motivo_cancelamento", () => {
    const { clause, params } = buildAutoInfracaoWhere({ motivo_cancelamento: "erro" })
    expect(clause).toBe(`WHERE ${MOTIVO_CANCELAMENTO_EXPR} ILIKE $1`)
    expect(params).toEqual(["%erro%"])
  })

  it("combines multiple filters with AND and positional params", () => {
    const { clause, params } = buildAutoInfracaoWhere({ agente: "vanessa", competencia: "Estadual/Rodoviário" })
    expect(clause).toBe(`WHERE ${AGENTE_EXPR} ILIKE $1 AND ${COMPETENCIA_EXPR} = $2`)
    expect(params).toEqual(["%vanessa%", "Estadual/Rodoviário"])
  })

  it("builds date time range filters for Data e Hora", () => {
    const { clause, params } = buildAutoInfracaoWhere({
      data_inicio: "2026-06-01T08:30",
      data_fim: "2026-06-30T18:45",
    })
    expect(clause).toBe(`WHERE ${DATA_HORA_EXPR} >= $1 AND ${DATA_HORA_EXPR} <= $2`)
    expect(params).toEqual(["2026-06-01T08:30", "2026-06-30T18:45"])
  })

  it("builds an equality clause for origem", () => {
    const { clause, params } = buildAutoInfracaoWhere({ origem: "Quixadá" })
    expect(clause).toBe(`WHERE ${ORIGEM_EXPR} = $1`)
    expect(params).toEqual(["Quixadá"])
  })

  it("ignores unknown/empty filter values", () => {
    const { clause, params } = buildAutoInfracaoWhere({ agente: "", local: undefined })
    expect(clause).toBe("")
    expect(params).toEqual([])
  })
})
