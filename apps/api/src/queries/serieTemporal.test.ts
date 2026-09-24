import { describe, it, expect } from "vitest"
import {
  resolveGranularity,
  bucketSqlExpression,
  formatBucketKey,
  generateBuckets,
} from "./serieTemporal"

describe("resolveGranularity", () => {
  it("returns hora for hoje", () => {
    expect(resolveGranularity("hoje", "2026-07-04T00:00", "2026-07-04T23:59")).toBe("hora")
  })

  it("returns diaSemana for semana", () => {
    expect(resolveGranularity("semana", "2026-06-29T00:00", "2026-07-05T23:59")).toBe("diaSemana")
  })

  it("returns dia for mês", () => {
    expect(resolveGranularity("mês", "2026-07-01T00:00", "2026-07-31T23:59")).toBe("dia")
  })

  it("returns mes for ano", () => {
    expect(resolveGranularity("ano", "2026-01-01T00:00", "2026-12-31T23:59")).toBe("mes")
  })

  it("returns dia for a customizado range of 31 days or fewer", () => {
    expect(resolveGranularity("customizado", "2026-07-01T00:00", "2026-07-15T23:59")).toBe("dia")
  })

  it("returns mes for a customizado range of more than 31 days", () => {
    expect(resolveGranularity("customizado", "2026-01-01T00:00", "2026-06-01T23:59")).toBe("mes")
  })

  it("defaults to dia when periodo_data is missing but a short range is given", () => {
    expect(resolveGranularity(undefined, "2026-07-01T00:00", "2026-07-10T23:59")).toBe("dia")
  })
})

describe("bucketSqlExpression", () => {
  it("returns the expected SQL fragment per granularity", () => {
    expect(bucketSqlExpression("hora")).toBe(`EXTRACT(HOUR FROM "Data e Hora")`)
    expect(bucketSqlExpression("diaSemana")).toBe(`EXTRACT(ISODOW FROM "Data e Hora")`)
    expect(bucketSqlExpression("dia")).toBe(`to_char("Data e Hora", 'YYYY-MM-DD')`)
    expect(bucketSqlExpression("mes")).toBe(`to_char("Data e Hora", 'YYYY-MM')`)
  })

  it("builds bucket expressions for a custom column", () => {
    expect(bucketSqlExpression("mes", "ai.data_hora")).toBe(`to_char(ai.data_hora, 'YYYY-MM')`)
    expect(bucketSqlExpression("hora", "ai.data_hora")).toBe(`EXTRACT(HOUR FROM ai.data_hora)`)
  })
})

describe("formatBucketKey", () => {
  it("zero-pads hour values", () => {
    expect(formatBucketKey("hora", 9)).toBe("09")
    expect(formatBucketKey("hora", "14")).toBe("14")
  })

  it("maps ISO day-of-week numbers to pt-BR abbreviations", () => {
    expect(formatBucketKey("diaSemana", 1)).toBe("seg")
    expect(formatBucketKey("diaSemana", 7)).toBe("dom")
  })

  it("passes dia/mes values through unchanged", () => {
    expect(formatBucketKey("dia", "2026-07-04")).toBe("2026-07-04")
    expect(formatBucketKey("mes", "2026-07")).toBe("2026-07")
  })
})

describe("generateBuckets", () => {
  it("returns 24 zero-padded hours for hora", () => {
    const buckets = generateBuckets("hora", "2026-07-04T00:00", "2026-07-04T23:59")
    expect(buckets).toHaveLength(24)
    expect(buckets[0]).toBe("00")
    expect(buckets[23]).toBe("23")
  })

  it("returns the 7 weekday abbreviations in Monday-start order for diaSemana", () => {
    expect(generateBuckets("diaSemana", "2026-06-29T00:00", "2026-07-05T23:59")).toEqual([
      "seg",
      "ter",
      "qua",
      "qui",
      "sex",
      "sab",
      "dom",
    ])
  })

  it("returns one bucket per day for dia", () => {
    const buckets = generateBuckets("dia", "2026-07-01T00:00", "2026-07-03T23:59")
    expect(buckets).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"])
  })

  it("returns one bucket per month for mes", () => {
    const buckets = generateBuckets("mes", "2026-01-01T00:00", "2026-03-15T23:59")
    expect(buckets).toEqual(["2026-01", "2026-02", "2026-03"])
  })
})
