import { Router } from "express"
import { pool } from "../db"
import { buildAutoInfracaoWhere } from "../queries/autoInfracaoFilters"
import { GOLD_STAR_FROM } from "../queries/goldStarExpressions"

export const processamentoRouter = Router()

type Faixa = { rotulo: string; de: number; ate: number | null; total: number; processados: number; dentroPrazo: boolean }

const LIMITE_FAIXAS = 30
const LARGURA_FAIXA = 5

function buildFaixas(nmax: number, prazo: number): Faixa[] {
  const faixas: Omit<Faixa, "total" | "processados">[] = []
  const add = (de: number, ate: number | null, rotulo: string) =>
    faixas.push({ rotulo, de, ate, dentroPrazo: ate !== null && ate <= prazo })

  for (let d = 1; d <= nmax; d++) add(d, d, String(d))
  const limite = Math.max(nmax, LIMITE_FAIXAS)
  for (let de = nmax + 1; de <= limite; ) {
    const ate = Math.min(limite, (Math.floor((de - 1) / LARGURA_FAIXA) + 1) * LARGURA_FAIXA)
    add(de, ate, de === ate ? String(de) : `${de}-${ate}`)
    de = ate + 1
  }
  add(limite + 1, null, `>${limite}`)
  return faixas.map((f) => ({ ...f, total: 0, processados: 0 }))
}

processamentoRouter.get("/api/processamento/stats", async (req, res) => {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined)
  const origem = str(req.query.origem)
  const { clause, params } = buildAutoInfracaoWhere({
    origem,
    data_inicio: str(req.query.data_inicio),
    data_fim: str(req.query.data_fim),
  })

  const prazoResult = await pool.query(
    origem
      ? `SELECT p.num_dias_retencao_processamento AS prazo
         FROM gold.dim_origem o
         JOIN gold.dim_parametro_origem p ON p.sk_origem = o.sk_origem
         WHERE o.nome = $1`
      : `SELECT max(num_dias_retencao_processamento) AS prazo FROM gold.dim_parametro_origem`,
    origem ? [origem] : [],
  )
  const prazoRaw = prazoResult.rows[0]?.prazo
  const prazo = prazoRaw === null || prazoRaw === undefined ? null : Number(prazoRaw)
  if (prazo === null) {
    res.json({ prazo: null, dentroPrazo: 0, foraPrazo: 0, faixas: [] })
    return
  }

  const extra = "ai.num_dias >= 1 AND p.num_dias_retencao_processamento IS NOT NULL"
  const where = clause ? `${clause} AND ${extra}` : `WHERE ${extra}`
  const result = await pool.query(
    `SELECT ai.num_dias AS num_dias,
            p.num_dias_retencao_processamento AS prazo,
            count(*) AS total,
            count(*) FILTER (
              WHERE ai.sk_auto > 0
                AND EXISTS (SELECT 1 FROM gold.fac_ait_retorno r WHERE r.sk_auto = ai.sk_auto)
            ) AS processados
     FROM ${GOLD_STAR_FROM}
       JOIN gold.dim_parametro_origem p ON p.sk_origem = ai.sk_origem
     ${where}
     GROUP BY ai.num_dias, p.num_dias_retencao_processamento`,
    params,
  )

  const faixas = buildFaixas(prazo, prazo)
  let dentroPrazo = 0
  let foraPrazo = 0
  for (const row of result.rows) {
    const dias = Number(row.num_dias)
    const total = Number(row.total)
    const processados = Number(row.processados)
    if (dias <= Number(row.prazo)) dentroPrazo += total
    else foraPrazo += total
    const faixa = faixas.find((f) => dias >= f.de && (f.ate === null || dias <= f.ate))
    if (faixa) {
      faixa.total += total
      faixa.processados += processados
    }
  }

  res.json({ prazo, dentroPrazo, foraPrazo, faixas })
})

processamentoRouter.get("/api/processamento/retornos", async (req, res) => {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined)
  const { clause, params } = buildAutoInfracaoWhere({
    origem: str(req.query.origem),
    data_inicio: str(req.query.data_inicio),
    data_fim: str(req.query.data_fim),
  })
  const extra = "ai.num_dias >= 1 AND ai.sk_auto > 0"
  const where = clause ? `${clause} AND ${extra}` : `WHERE ${extra}`
  const result = await pool.query(
    `SELECT c.descricao AS tipo, count(DISTINCT ai.sk_auto) AS total
     FROM ${GOLD_STAR_FROM}
       JOIN gold.fac_ait_retorno r ON r.sk_auto = ai.sk_auto
       JOIN gold.dim_codigo_retorno c ON c.sk_codigo_retorno = r.sk_codigo_retorno
     ${where}
     GROUP BY c.descricao
     ORDER BY total DESC, c.descricao`,
    params,
  )
  res.json({ retornos: result.rows.map((row) => ({ tipo: row.tipo, total: Number(row.total) })) })
})
