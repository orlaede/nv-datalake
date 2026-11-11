import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import { createApp as buildApp } from "../server"
import { pool } from "../db"
import { GOLD_STAR_FROM, ORIGEM_EXPR } from "../queries/goldStarExpressions"

vi.mock("../db", () => ({
  pool: { query: vi.fn() },
}))

const createApp = () => buildApp({ disableAuth: true })

describe("GET /api/processamento/stats", () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset()
  })

  it("monta faixas diárias, de 5 em 5 e >30 com KPIs, filtrando por origem", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ prazo: 3 }] } as never)
      .mockResolvedValueOnce({
        rows: [
          { num_dias: 1, prazo: 3, total: "10", nao_processados: "1" },
          { num_dias: 3, prazo: 3, total: "4", nao_processados: "0" },
          { num_dias: 5, prazo: 3, total: "2", nao_processados: "1" },
          { num_dias: 8, prazo: 3, total: "3", nao_processados: "3" },
          { num_dias: 40, prazo: 3, total: "1", nao_processados: "1" },
        ],
      } as never)

    const res = await request(createApp())
      .get("/api/processamento/stats")
      .query({ origem: "Pomerode", data_inicio: "2026-01-01", data_fim: "2026-06-30" })

    expect(res.status).toBe(200)
    expect(res.body.prazo).toBe(3)
    expect(res.body.totalAutos).toBe(20)
    expect(res.body.processados).toBe(14)
    expect(res.body.dentroPrazo).toBe(1)
    expect(res.body.foraPrazo).toBe(5)
    expect(res.body.faixas.map((f: { rotulo: string }) => f.rotulo)).toEqual([
      "1", "2", "3", "4-5", "6-10", "11-15", "16-20", "21-25", "26-30", ">30",
    ])
    expect(res.body.faixas[0]).toEqual({ rotulo: "1", de: 1, ate: 1, total: 1, dentroPrazo: true })
    expect(res.body.faixas[1]).toMatchObject({ total: 0, dentroPrazo: true })
    expect(res.body.faixas[3]).toMatchObject({ rotulo: "4-5", de: 4, ate: 5, total: 1, dentroPrazo: false })
    expect(res.body.faixas[4]).toMatchObject({ total: 3 })
    expect(res.body.faixas[9]).toEqual({ rotulo: ">30", de: 31, ate: null, total: 1, dentroPrazo: false })

    const [prazoCall, statsCall] = vi.mocked(pool.query).mock.calls
    expect(prazoCall[1]).toEqual(["Pomerode"])
    expect(statsCall[0]).toContain(`FROM ${GOLD_STAR_FROM}`)
    expect(statsCall[0]).toContain(`${ORIGEM_EXPR} = $3 AND ai.num_dias >= 1`)
    expect(statsCall[0]).toContain("ai.num_dias >= 1")
    expect(statsCall[0]).toContain("status_arquivamento IS DISTINCT FROM 'PROCESSADO_SUCESSO'")
    expect(statsCall[1]).toEqual(["2026-01-01", "2026-06-30", "Pomerode"])
  })

  it("usa maior prazo sem filtro de origem; prazo >= 30 gera diárias até N e >N", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ prazo: 30 }] } as never)
      .mockResolvedValueOnce({ rows: [{ num_dias: 31, prazo: 30, total: "2", nao_processados: "1" }] } as never)

    const res = await request(createApp()).get("/api/processamento/stats")

    expect(res.status).toBe(200)
    expect(res.body.faixas).toHaveLength(31)
    expect(res.body.faixas[29].rotulo).toBe("30")
    expect(res.body.faixas[30]).toEqual({ rotulo: ">30", de: 31, ate: null, total: 1, dentroPrazo: false })
    expect(res.body.foraPrazo).toBe(1)
    expect(vi.mocked(pool.query).mock.calls[1][0]).toContain("WHERE ai.num_dias >= 1")
  })

  it("sem prazo configurado retorna vazio", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ prazo: null }] } as never)
    const res = await request(createApp()).get("/api/processamento/stats")
    expect(res.body).toEqual({ prazo: null, totalAutos: 0, processados: 0, dentroPrazo: 0, foraPrazo: 0, faixas: [] })
    expect(pool.query).toHaveBeenCalledTimes(1)
  })

  it("retornos: autos distintos por tipo de retorno", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        { tipo: "Sucesso", total: "7" },
        { tipo: "Erro", total: "2" },
      ],
    } as never)
    const res = await request(createApp()).get("/api/processamento/retornos").query({ origem: "Pomerode" })
    expect(res.status).toBe(200)
    expect(res.body.retornos).toEqual([
      { tipo: "Sucesso", total: 7 },
      { tipo: "Erro", total: 2 },
    ])
    const [sql, params] = vi.mocked(pool.query).mock.calls[0]
    expect(sql).toContain("count(DISTINCT ai.sk_auto)")
    expect(params).toEqual(["Pomerode"])
  })
})
