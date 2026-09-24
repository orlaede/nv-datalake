import { describe, it, expect } from "vitest"
import { buildAutoInfracaoWhere } from "./autoInfracaoFilters"

describe("buildAutoInfracaoWhere", () => {
  it("returns empty clause and no params when no filters given", () => {
    const { clause, params } = buildAutoInfracaoWhere({})
    expect(clause).toBe("")
    expect(params).toEqual([])
  })

  it("builds an ILIKE clause with wildcards for free-text filters", () => {
    const { clause, params } = buildAutoInfracaoWhere({ agente: "vanessa" })
    expect(clause).toBe(`WHERE "Nome do Agente" ILIKE $1`)
    expect(params).toEqual(["%vanessa%"])
  })

  it("builds an equality clause for enum-like filters", () => {
    const { clause, params } = buildAutoInfracaoWhere({ periodo: "Manhã" })
    expect(clause).toBe(`WHERE "Turno" = $1`)
    expect(params).toEqual(["Manhã"])
  })

  it("builds an equality clause for origem", () => {
    const { clause, params } = buildAutoInfracaoWhere({ origem: "Quixadá" })
    expect(clause).toBe(`WHERE "Origem" = $1`)
    expect(params).toEqual(["Quixadá"])
  })

  it("casts codigo to text for comparison", () => {
    const { clause, params } = buildAutoInfracaoWhere({ codigo: "57380" })
    expect(clause).toBe(`WHERE "Código da Infração"::text = $1`)
    expect(params).toEqual(["57380"])
  })

  it("coalesces both cancellation justification columns for motivo_cancelamento", () => {
    const { clause, params } = buildAutoInfracaoWhere({ motivo_cancelamento: "erro" })
    expect(clause).toBe(
      `WHERE COALESCE("Justificativa do Cancelamento pelo Agente", "Justificativa do Cancelamento pelo Gestor") ILIKE $1`
    )
    expect(params).toEqual(["%erro%"])
  })

  it("combines multiple filters with AND and positional params", () => {
    const { clause, params } = buildAutoInfracaoWhere({ agente: "vanessa", competencia: "Estadual/Rodoviário" })
    expect(clause).toBe(`WHERE "Nome do Agente" ILIKE $1 AND "Competência" = $2`)
    expect(params).toEqual(["%vanessa%", "Estadual/Rodoviário"])
  })

  it("builds date time range filters for Data e Hora", () => {
    const { clause, params } = buildAutoInfracaoWhere({
      data_inicio: "2026-06-01T08:30",
      data_fim: "2026-06-30T18:45",
    })
    expect(clause).toBe(`WHERE "Data e Hora" >= $1 AND "Data e Hora" <= $2`)
    expect(params).toEqual(["2026-06-01T08:30", "2026-06-30T18:45"])
  })

  it("ignores unknown/empty filter values", () => {
    const { clause, params } = buildAutoInfracaoWhere({ agente: "", local: undefined })
    expect(clause).toBe("")
    expect(params).toEqual([])
  })
})
