import { Router } from "express"
import { pool } from "../db"
import { buildAutoInfracaoWhere } from "../queries/autoInfracaoFilters"
import { GOLD_STAR_FROM } from "../queries/goldStarExpressions"
import { LIST_COLUMNS_SQL, extractFilters } from "./autosInfracao"

export const processamentoRouter = Router()

// Retornos que não indicam falha de processamento: ficam fora do gráfico e da listagem.
const RETORNOS_IGNORADOS = ["SUCESSO", "Não Informado"]

type Faixa = { rotulo: string; de: number; ate: number | null; total: number; dentroPrazo: boolean }

const LIMITE_FAIXAS = 30
const LARGURA_FAIXA = 5

function buildFaixas(nmax: number, prazo: number): Faixa[] {
  const faixas: Omit<Faixa, "total">[] = []
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
  return faixas.map((f) => ({ ...f, total: 0 }))
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
    res.json({ prazo: null, totalAutos: 0, processados: 0, dentroPrazo: 0, foraPrazo: 0, faixas: [] })
    return
  }

  const extra = "ai.num_dias >= 1 AND p.num_dias_retencao_processamento IS NOT NULL"
  const where = clause ? `${clause} AND ${extra}` : `WHERE ${extra}`
  const result = await pool.query(
    `SELECT ai.num_dias AS num_dias,
            p.num_dias_retencao_processamento AS prazo,
            count(*) AS total,
            count(*) FILTER (WHERE ai.status_arquivamento IS DISTINCT FROM 'PROCESSADO_SUCESSO') AS nao_processados
     FROM ${GOLD_STAR_FROM}
       JOIN gold.dim_parametro_origem p ON p.sk_origem = ai.sk_origem
     ${where}
     GROUP BY ai.num_dias, p.num_dias_retencao_processamento`,
    params,
  )

  const faixas = buildFaixas(prazo, prazo)
  let totalAutos = 0
  let naoProcessadosTotal = 0
  let dentroPrazo = 0
  let foraPrazo = 0
  for (const row of result.rows) {
    const dias = Number(row.num_dias)
    const total = Number(row.total)
    const naoProcessados = Number(row.nao_processados)
    totalAutos += total
    naoProcessadosTotal += naoProcessados
    if (dias <= Number(row.prazo)) dentroPrazo += naoProcessados
    else foraPrazo += naoProcessados
    const faixa = faixas.find((f) => dias >= f.de && (f.ate === null || dias <= f.ate))
    if (faixa) {
      faixa.total += naoProcessados
    }
  }

  res.json({ prazo, totalAutos, processados: totalAutos - naoProcessadosTotal, dentroPrazo, foraPrazo, faixas })
})

processamentoRouter.get("/api/processamento/retornos", async (req, res) => {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined)
  const { clause, params } = buildAutoInfracaoWhere({
    origem: str(req.query.origem),
    data_inicio: str(req.query.data_inicio),
    data_fim: str(req.query.data_fim),
  })
  const extra = `ai.num_dias >= 1 AND ai.sk_auto > 0 AND c.descricao <> ALL ($${params.length + 1}::text[])`
  const where = clause ? `${clause} AND ${extra}` : `WHERE ${extra}`
  const result = await pool.query(
    `SELECT c.descricao AS tipo, count(DISTINCT ai.sk_auto) AS total
     FROM ${GOLD_STAR_FROM}
       JOIN gold.fac_ait_retorno r ON r.sk_auto = ai.sk_auto
       JOIN gold.dim_codigo_retorno c ON c.sk_codigo_retorno = r.sk_codigo_retorno
     ${where}
     GROUP BY c.descricao
     ORDER BY total DESC, c.descricao`,
    [...params, RETORNOS_IGNORADOS],
  )
  res.json({ retornos: result.rows.map((row) => ({ tipo: row.tipo, total: Number(row.total) })) })
})

processamentoRouter.get("/api/processamento/retornos/autos", async (req, res) => {
  const retorno = typeof req.query.retorno === "string" ? req.query.retorno : ""
  if (!retorno || RETORNOS_IGNORADOS.includes(retorno)) {
    res.status(400).json({ error: "retorno is required" })
    return
  }
  const num = (v: unknown, fallback: number) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback)
  const page = Math.max(1, num(req.query.page, 1))
  const pageSize = Math.min(100, Math.max(1, num(req.query.pageSize, 25)))

  const { clause, params } = buildAutoInfracaoWhere(extractFilters(req.query as Record<string, unknown>))
  params.push(retorno)
  const extra = `ai.num_dias >= 1 AND ai.sk_auto > 0 AND EXISTS (
       SELECT 1 FROM gold.fac_ait_retorno r
         JOIN gold.dim_codigo_retorno c ON c.sk_codigo_retorno = r.sk_codigo_retorno
       WHERE r.sk_auto = ai.sk_auto AND c.descricao = $${params.length})`
  const where = clause ? `${clause} AND ${extra}` : `WHERE ${extra}`

  const countResult = await pool.query(`SELECT COUNT(*) FROM ${GOLD_STAR_FROM} ${where}`, params)
  const total = Number(countResult.rows[0].count)
  const listResult = await pool.query(
    `SELECT ROW_NUMBER() OVER (ORDER BY ai.data_hora DESC NULLS LAST) AS id,
       ${LIST_COLUMNS_SQL}
     FROM ${GOLD_STAR_FROM}
     ${where}
     ORDER BY ai.data_hora DESC NULLS LAST
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  )
  res.json({ total, page, pageSize, rows: listResult.rows })
})
