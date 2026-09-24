import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import { createApp as buildApp } from "../server"
import { pool } from "../db"
import {
  AGENTE_EXPR,
  CODIGO_EXPR,
  COMPETENCIA_EXPR,
  EQUIPAMENTO_EXPR,
  GOLD_STAR_FROM,
  MOTIVO_CANCELAMENTO_EXPR,
  ORIGEM_EXPR,
  PERIODO_EXPR,
  STATUS_EXPR,
  TIPO_EXPR,
} from "../queries/goldStarExpressions"

vi.mock("../db", () => ({
  pool: { query: vi.fn() },
}))

const createApp = () => buildApp({ disableAuth: true })

describe("GET /api/autos-infracao", () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset()
  })

  it("returns paginated rows filtered by query params with all Gold fact fields", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ count: "1" }] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            data_hora: "2026-06-12T08:15:00Z",
            agente: "Agente 001",
            local: "Rua A",
            tipo: "Sem Abordagem",
            codigo: "123",
            numero_auto: "456",
            equipamento: "Radar 01",
            periodo: "Manhã",
            competencia: "Municipal",
            motivo_cancelamento: null,
            status: "Válido",
          },
        ],
      } as never)

    const app = createApp()
    const res = await request(app).get("/api/autos-infracao").query({ agente: "Vanessa", page: "1", pageSize: "20" })

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.rows).toHaveLength(1)
    expect(res.body.rows[0]).toMatchObject({
      codigo: "123",
      numero_auto: "456",
      equipamento: "Radar 01",
      periodo: "Manhã",
      competencia: "Municipal",
      motivo_cancelamento: null,
    })

    const [countCall, listCall] = vi.mocked(pool.query).mock.calls
    expect(countCall[0]).toContain(`WHERE ${AGENTE_EXPR} ILIKE $1`)
    expect(listCall[0]).toContain(`${CODIGO_EXPR} AS codigo`)
    expect(listCall[0]).toContain(`ai.num_auto::text AS numero_auto`)
    expect(listCall[0]).toContain(`${EQUIPAMENTO_EXPR} AS equipamento`)
    expect(listCall[0]).toContain(`${PERIODO_EXPR} AS periodo`)
    expect(listCall[0]).toContain(`${COMPETENCIA_EXPR} AS competencia`)
    expect(listCall[0]).toContain(`${MOTIVO_CANCELAMENTO_EXPR} AS motivo_cancelamento`)
    expect(listCall[0]).toContain(`${STATUS_EXPR} AS status`)
    expect(countCall[0]).toContain(`FROM ${GOLD_STAR_FROM}`)
    expect(listCall[0]).toContain(`FROM ${GOLD_STAR_FROM}`)
    expect(listCall[0]).toContain("left join gold.dim_agente")
    expect(countCall[0]).not.toContain("ce_eusebio.vw_bi_auto_infracao")
    expect(listCall[0]).not.toContain("ce_eusebio.vw_bi_auto_infracao")
    expect(listCall[0]).toContain("LIMIT $2 OFFSET $3")
    expect(listCall[1]).toEqual(["%Vanessa%", 20, 0])
  })

  it("passes the origem filter through to the query", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ count: "0" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)

    const app = createApp()
    const res = await request(app).get("/api/autos-infracao").query({ origem: "Quixadá" })

    expect(res.status).toBe(200)
    const [countCall, listCall] = vi.mocked(pool.query).mock.calls
    expect(countCall[0]).toContain(`WHERE ${ORIGEM_EXPR} = $1`)
    expect(listCall[0]).toContain(`WHERE ${ORIGEM_EXPR} = $1`)
    expect(listCall[1]).toEqual(["Quixadá", 20, 0])
  })

  it("returns 400 when page is non-numeric", async () => {
    const app = createApp()
    const res = await request(app).get("/api/autos-infracao").query({ page: "abc" })

    expect(res.status).toBe(400)
    expect(pool.query).not.toHaveBeenCalled()
  })

  it("returns 400 when pageSize is non-numeric", async () => {
    const app = createApp()
    const res = await request(app).get("/api/autos-infracao").query({ pageSize: "abc" })

    expect(res.status).toBe(400)
    expect(pool.query).not.toHaveBeenCalled()
  })

  it("rejects requests without a JWT", async () => {
    const res = await request(buildApp()).get("/api/autos-infracao")

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: "Autenticação necessária" })
    expect(pool.query).not.toHaveBeenCalled()
  })
})

describe("GET /api/autos-infracao/stats", () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset()
  })

  it("returns total count, top agents and breakdown by motivo de cancelamento", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ count: "42" }] } as never) // total
      .mockResolvedValueOnce({
        rows: [{ agente: "Agente 001", total: "12" }],
      } as never) // porAgente
      .mockResolvedValueOnce({
        rows: [{ motivo_cancelamento: "Erro de digitação", total: "5" }],
      } as never) // porMotivoCancelamento
      .mockResolvedValueOnce({ rows: [{ count: "3" }] } as never) // numAgentes
      .mockResolvedValueOnce({ rows: [{ count: "2" }] } as never) // numEquipamentos
      .mockResolvedValueOnce({ rows: [] } as never) // serieTemporal raw
      .mockResolvedValueOnce({ rows: [] } as never) // porTipo
      .mockResolvedValueOnce({ rows: [] } as never) // porCompetencia
      .mockResolvedValueOnce({ rows: [] } as never) // porMesComparativo atual raw
      .mockResolvedValueOnce({ rows: [] } as never) // porMesComparativo anterior raw

    const app = createApp()
    const res = await request(app).get("/api/autos-infracao/stats").query({ competencia: "Estadual/Rodoviário" })

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(42)
    expect(res.body.porAgente).toEqual([{ agente: "Agente 001", total: "12" }])
    expect(res.body.porMotivoCancelamento).toEqual([
      { motivo_cancelamento: "Erro de digitação", total: "5" },
    ])

    const [countCall, agentCall, groupCall] = vi.mocked(pool.query).mock.calls
    expect(countCall[0]).toContain(`WHERE ${COMPETENCIA_EXPR} = $1`)
    expect(agentCall[0]).toContain(`${AGENTE_EXPR} AS agente`)
    expect(agentCall[0]).toContain("LIMIT 10")
    expect(groupCall[0]).toContain("GROUP BY")
    expect(groupCall[0]).toContain(`${COMPETENCIA_EXPR} = $1 AND (`)
  })
})

describe("GET /api/autos-infracao/suggestions", () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset()
  })

  it("returns distinct suggestions for supported autocomplete fields after 3 characters", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ value: "Vanessa Cordeiro Celestino" }],
    } as never)

    const app = createApp()
    const res = await request(app)
      .get("/api/autos-infracao/suggestions")
      .query({ field: "agente", q: "Van" })

    expect(res.status).toBe(200)
    expect(res.body.suggestions).toEqual(["Vanessa Cordeiro Celestino"])

    const [suggestionsCall] = vi.mocked(pool.query).mock.calls
    expect(suggestionsCall[0]).toContain(`${AGENTE_EXPR} AS value`)
    expect(suggestionsCall[0]).toContain(`ILIKE $1`)
    expect(suggestionsCall[0]).toContain("LIMIT 10")
    expect(suggestionsCall[1]).toEqual(["%Van%"])
  })

  it.each([
    ["agente", `${AGENTE_EXPR} AS value`],
    ["codigo", `${CODIGO_EXPR} AS value`],
    ["equipamento", `${EQUIPAMENTO_EXPR} AS value`],
    ["motivo_cancelamento", `${MOTIVO_CANCELAMENTO_EXPR} AS value`],
  ])("supports %s suggestions", async (field, selectExpression) => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never)

    const app = createApp()
    const res = await request(app)
      .get("/api/autos-infracao/suggestions")
      .query({ field, q: "abc" })

    expect(res.status).toBe(200)
    expect(vi.mocked(pool.query).mock.calls.at(-1)?.[0]).toContain(selectExpression)
  })

  it("does not query suggestions before 3 characters", async () => {
    const app = createApp()
    const res = await request(app)
      .get("/api/autos-infracao/suggestions")
      .query({ field: "agente", q: "Va" })

    expect(res.status).toBe(200)
    expect(res.body.suggestions).toEqual([])
    expect(pool.query).not.toHaveBeenCalled()
  })

  it("rejects unsupported suggestion fields", async () => {
    const app = createApp()
    const res = await request(app)
      .get("/api/autos-infracao/suggestions")
      .query({ field: "tipo", q: "Sem Abordagem" })

    expect(res.status).toBe(400)
    expect(pool.query).not.toHaveBeenCalled()
  })
})

describe("GET /api/autos-infracao/stats — dashboard chart fields", () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset()
  })

  it("returns numAgentes, numEquipamentos, zero-filled serieTemporal, porTipo and porCompetencia", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ count: "2" }] } as never) // total
      .mockResolvedValueOnce({ rows: [{ agente: "Agente 001", total: "2" }] } as never) // porAgente
      .mockResolvedValueOnce({ rows: [] } as never) // porMotivoCancelamento
      .mockResolvedValueOnce({ rows: [{ count: "1" }] } as never) // numAgentes
      .mockResolvedValueOnce({ rows: [{ count: "1" }] } as never) // numEquipamentos
      .mockResolvedValueOnce({ rows: [{ bucket: "1", total: "2" }] } as never) // serieTemporal raw
      .mockResolvedValueOnce({
        rows: [{ tipo: "Sem Abordagem", total: "2" }],
      } as never) // porTipo
      .mockResolvedValueOnce({
        rows: [{ competencia: "Municipal", total: "2" }],
      } as never) // porCompetencia
      .mockResolvedValueOnce({
        rows: [
          { ym: "2026-06", total: "1" },
          { ym: "2026-07", total: "1" },
        ],
      } as never) // porMesComparativo atual raw
      .mockResolvedValueOnce({ rows: [{ ym: "2025-06", total: "3" }] } as never) // porMesComparativo anterior raw

    const app = createApp()
    const res = await request(app)
      .get("/api/autos-infracao/stats")
      .query({ periodo_data: "semana", data_inicio: "2026-06-29T00:00", data_fim: "2026-07-05T23:59" })

    expect(res.status).toBe(200)
    expect(res.body.numAgentes).toBe(1)
    expect(res.body.numEquipamentos).toBe(1)
    expect(res.body.porTipo).toEqual([{ tipo: "Sem Abordagem", total: "2" }])
    expect(res.body.porCompetencia).toEqual([{ competencia: "Municipal", total: "2" }])
    expect(res.body.serieTemporal).toEqual([
      { bucket: "seg", total: 2 },
      { bucket: "ter", total: 0 },
      { bucket: "qua", total: 0 },
      { bucket: "qui", total: 0 },
      { bucket: "sex", total: 0 },
      { bucket: "sab", total: 0 },
      { bucket: "dom", total: 0 },
    ])
    expect(res.body.porMesComparativo).toEqual([
      { mes: "Jun/26", atual: 1, anterior: 3 },
      { mes: "Jul/26", atual: 1, anterior: 0 },
    ])

    const calls = vi.mocked(pool.query).mock.calls
    expect(calls[3][0]).toContain(`COUNT(DISTINCT ${AGENTE_EXPR})`)
    expect(calls[4][0]).toContain(`COUNT(DISTINCT ${EQUIPAMENTO_EXPR})`)
    expect(calls[5][0]).toContain(`EXTRACT(ISODOW FROM ai.data_hora)`)
    expect(calls[6][0]).toContain(`${TIPO_EXPR} AS tipo`)
    expect(calls[7][0]).toContain(`${COMPETENCIA_EXPR} AS competencia`)
  })
})

describe("GET /api/autos-infracao/origens", () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset()
  })

  it("returns origin names ordered from gold.dim_origem", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ nome: "Caucaia (Amostra)" }, { nome: "Quixadá" }],
    } as never)

    const app = createApp()
    const res = await request(app).get("/api/autos-infracao/origens")

    expect(res.status).toBe(200)
    expect(res.body.origens).toEqual(["Caucaia (Amostra)", "Quixadá"])

    const [call] = vi.mocked(pool.query).mock.calls
    expect(call[0]).toContain("FROM gold.dim_origem")
    expect(call[0]).toContain("ORDER BY nome")
  })
})
