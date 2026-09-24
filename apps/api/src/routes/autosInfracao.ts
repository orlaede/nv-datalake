import { Router } from "express"
import ExcelJS from "exceljs"
import PDFDocument from "pdfkit"
import { requirePermission } from "../auth/middleware"
import { pool } from "../db"
import { buildAutoInfracaoWhere, type AutoInfracaoFilters } from "../queries/autoInfracaoFilters"
import {
  AGENTE_EXPR,
  CODIGO_EXPR,
  COMPETENCIA_EXPR,
  DATA_HORA_EXPR,
  EQUIPAMENTO_EXPR,
  GOLD_STAR_FROM,
  LOCAL_EXPR,
  MOTIVO_CANCELAMENTO_EXPR,
  PERIODO_EXPR,
  STATUS_EXPR,
  TIPO_EXPR,
} from "../queries/goldStarExpressions"
import { bucketSqlExpression, formatBucketKey, generateBuckets, resolveGranularity } from "../queries/serieTemporal"

export const autosInfracaoRouter = Router()

autosInfracaoRouter.get("/api/autos-infracao/origens", async (_req, res) => {
  const result = await pool.query(`SELECT nome FROM gold.dim_origem ORDER BY nome`)
  res.json({ origens: result.rows.map((row) => row.nome) })
})

const EXPORT_COLUMNS = [
  { key: "numero_auto", header: "Número do Auto" },
  { key: "data_hora", header: "Data/Hora" },
  { key: "agente", header: "Agente" },
  { key: "codigo", header: "Código da Infração" },
  { key: "local", header: "Local" },
  { key: "tipo", header: "Tipo" },
  { key: "equipamento", header: "Equipamento" },
  { key: "periodo", header: "Turno" },
  { key: "competencia", header: "Competência" },
  { key: "motivo_cancelamento", header: "Motivo Cancelamento" },
  { key: "status", header: "Status do Auto" },
] as const

type ExportColumnKey = (typeof EXPORT_COLUMNS)[number]["key"]
const EXPORT_COLUMN_KEYS = new Set<string>(EXPORT_COLUMNS.map((c) => c.key))

const DATE_GROUP_HEADER_BY_KEY = {
  ano: "Ano",
  mes: "Mês",
  dia: "Dia",
  hora: "Hora",
  semana_ano: "Semana do Ano",
  dia_semana: "Dia da Semana",
} as const

type DateGroupKey = keyof typeof DATE_GROUP_HEADER_BY_KEY
type GroupKey = ExportColumnKey | DateGroupKey
const GROUP_KEYS = new Set<string>([...EXPORT_COLUMN_KEYS, ...Object.keys(DATE_GROUP_HEADER_BY_KEY)])

const GROUP_HEADER_BY_KEY = new Map<string, string>([
  ...EXPORT_COLUMNS.map((c): [string, string] => [c.key, c.header]),
  ...Object.entries(DATE_GROUP_HEADER_BY_KEY),
])

function formatExportCodigo(value: string | null): string {
  if (!value || value.length < 2) return value ?? ""
  return `${value.slice(0, -1)}-${value.slice(-1)}`
}

function formatExportDataHora(value: string | Date | null): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function partitionByColumn<T extends Record<string, unknown>>(rows: T[], column: string) {
  const groups: { value: unknown; rows: T[] }[] = []
  let current: { value: unknown; rows: T[] } | undefined
  for (const row of rows) {
    const value = row[column]
    if (!current || current.value !== value) {
      current = { value, rows: [] }
      groups.push(current)
    }
    current.rows.push(row)
  }
  return groups
}

function writeRows(
  sheet: ExcelJS.Worksheet,
  rows: Record<string, unknown>[],
  groupBy: GroupKey[],
  level: number
) {
  if (level >= groupBy.length) {
    for (const row of rows) {
      sheet.addRow(
        EXPORT_COLUMNS.map(({ key }) => {
          if (key === "codigo") return formatExportCodigo(row[key] as string | null)
          if (key === "data_hora") return formatExportDataHora(row[key] as string | null)
          return row[key] ?? "—"
        })
      )
    }
    return
  }

  const column = groupBy[level]
  const header = GROUP_HEADER_BY_KEY.get(column)
  for (const group of partitionByColumn(rows, column)) {
    const label = column === "codigo" ? formatExportCodigo(group.value as string | null) : (group.value ?? "—")
    const groupRow = sheet.addRow([`${"  ".repeat(level)}${header}: ${label} (${group.rows.length})`])
    sheet.mergeCells(groupRow.number, 1, groupRow.number, EXPORT_COLUMNS.length)
    groupRow.font = { bold: true }
    groupRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    }
    writeRows(sheet, group.rows, groupBy, level + 1)
  }
}

type GroupNode = { value: unknown; total: number; children?: GroupNode[] }

function buildGroupTree(
  rows: Record<string, unknown>[],
  groupBy: GroupKey[],
  level: number
): GroupNode[] {
  if (!rows.length) return []
  return partitionByColumn(rows, `g${level}`).map((group) => {
    const total = group.rows.reduce((sum, row) => sum + Number(row.total), 0)
    const node: GroupNode = { value: group.value, total }
    if (level + 1 < groupBy.length) {
      node.children = buildGroupTree(group.rows, groupBy, level + 1)
    }
    return node
  })
}

function parseGroupBy(query: Record<string, unknown>): GroupKey[] {
  return (typeof query.groupBy === "string" ? query.groupBy.split(",") : [])
    .map((key) => key.trim())
    .filter((key): key is GroupKey => GROUP_KEYS.has(key))
}

const LIST_COLUMNS_SQL = `
       ai.data_hora AS data_hora,
       ${AGENTE_EXPR} AS agente,
       ${LOCAL_EXPR} AS local,
       ${TIPO_EXPR} AS tipo,
       ${CODIGO_EXPR} AS codigo,
       ai.num_auto::text AS numero_auto,
       ${EQUIPAMENTO_EXPR} AS equipamento,
       ${PERIODO_EXPR} AS periodo,
       ${COMPETENCIA_EXPR} AS competencia,
       ${MOTIVO_CANCELAMENTO_EXPR} AS motivo_cancelamento,
       ${STATUS_EXPR} AS status`

const GROUP_COLUMN_EXPR: Record<GroupKey, string> = {
  numero_auto: `ai.num_auto::text`,
  data_hora: DATA_HORA_EXPR,
  agente: AGENTE_EXPR,
  codigo: CODIGO_EXPR,
  local: LOCAL_EXPR,
  tipo: TIPO_EXPR,
  equipamento: EQUIPAMENTO_EXPR,
  periodo: PERIODO_EXPR,
  competencia: COMPETENCIA_EXPR,
  motivo_cancelamento: MOTIVO_CANCELAMENTO_EXPR,
  status: STATUS_EXPR,
  ano: `to_char(ai.data_hora, 'YYYY')`,
  mes: `to_char(ai.data_hora, 'YYYY-MM')`,
  dia: `to_char(ai.data_hora, 'YYYY-MM-DD')`,
  hora: `to_char(ai.data_hora, 'HH24')`,
  semana_ano: `to_char(ai.data_hora, 'IYYY-"W"IW')`,
  dia_semana: `case extract(isodow from ai.data_hora) when 1 then 'Segunda-feira' when 2 then 'Terça-feira' when 3 then 'Quarta-feira' when 4 then 'Quinta-feira' when 5 then 'Sexta-feira' when 6 then 'Sábado' else 'Domingo' end`,
}

const DATE_GROUP_KEYS = new Set<string>(Object.keys(DATE_GROUP_HEADER_BY_KEY))

const SUGGESTION_FIELDS = {
  agente: AGENTE_EXPR,
  local: LOCAL_EXPR,
  codigo: CODIGO_EXPR,
  equipamento: EQUIPAMENTO_EXPR,
  motivo_cancelamento: MOTIVO_CANCELAMENTO_EXPR,
} as const

function extractFilters(query: Record<string, unknown>): AutoInfracaoFilters {
  return {
    agente: typeof query.agente === "string" ? query.agente : undefined,
    local: typeof query.local === "string" ? query.local : undefined,
    tipo: typeof query.tipo === "string" ? query.tipo : undefined,
    codigo: typeof query.codigo === "string" ? query.codigo : undefined,
    equipamento: typeof query.equipamento === "string" ? query.equipamento : undefined,
    periodo: typeof query.periodo === "string" ? query.periodo : undefined,
    data_inicio: typeof query.data_inicio === "string" ? query.data_inicio : undefined,
    data_fim: typeof query.data_fim === "string" ? query.data_fim : undefined,
    competencia: typeof query.competencia === "string" ? query.competencia : undefined,
    motivo_cancelamento: typeof query.motivo_cancelamento === "string" ? query.motivo_cancelamento : undefined,
    origem: typeof query.origem === "string" ? query.origem : undefined,
  }
}

function parsePositiveInt(value: unknown, fallback: number): number | undefined {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

autosInfracaoRouter.get("/api/autos-infracao", async (req, res) => {
  const rawPage = parsePositiveInt(req.query.page, 1)
  const rawPageSize = parsePositiveInt(req.query.pageSize, 20)
  if (rawPage === undefined || rawPageSize === undefined) {
    res.status(400).json({ error: "page and pageSize must be numeric" })
    return
  }

  const filters = extractFilters(req.query as Record<string, unknown>)
  const { clause, params } = buildAutoInfracaoWhere(filters)

  const page = Math.max(1, rawPage)
  const pageSize = Math.min(100, Math.max(1, rawPageSize))
  const offset = (page - 1) * pageSize

  const countResult = await pool.query(`SELECT COUNT(*) FROM ${GOLD_STAR_FROM} ${clause}`, params)
  const total = Number(countResult.rows[0].count)

  const listResult = await pool.query(
    `SELECT
       ROW_NUMBER() OVER (ORDER BY ai.data_hora DESC NULLS LAST) AS id,
       ${LIST_COLUMNS_SQL}
     FROM ${GOLD_STAR_FROM}
     ${clause}
     ORDER BY ai.data_hora DESC NULLS LAST
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset]
  )

  res.json({ total, page, pageSize, rows: listResult.rows })
})

autosInfracaoRouter.get("/api/autos-infracao/groups", async (req, res) => {
  const filters = extractFilters(req.query as Record<string, unknown>)
  const groupBy = parseGroupBy(req.query as Record<string, unknown>)
  if (!groupBy.length) {
    res.json({ groups: [] })
    return
  }

  const { clause, params } = buildAutoInfracaoWhere(filters)
  const selectCols = groupBy.map((key, i) => `${GROUP_COLUMN_EXPR[key]} AS g${i}`).join(", ")
  const groupCols = groupBy.map((_, i) => `g${i}`).join(", ")

  const result = await pool.query(
    `SELECT ${selectCols}, COUNT(*) AS total
     FROM ${GOLD_STAR_FROM}
     ${clause}
     GROUP BY ${groupCols}
     ORDER BY ${groupCols}`,
    params
  )

  res.json({ groups: buildGroupTree(result.rows, groupBy, 0) })
})

type GroupPathSegment = { key: string; value: string | null }

function parseGroupPath(raw: unknown): GroupPathSegment[] {
  if (typeof raw !== "string" || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (segment): segment is GroupPathSegment =>
          segment && typeof segment.key === "string" && GROUP_KEYS.has(segment.key)
      )
      .map((segment) => ({
        key: segment.key,
        value: segment.value === null ? null : String(segment.value),
      }))
  } catch {
    return []
  }
}

autosInfracaoRouter.get("/api/autos-infracao/group-rows", async (req, res) => {
  const rawPage = parsePositiveInt(req.query.page, 1)
  const rawPageSize = parsePositiveInt(req.query.pageSize, 20)
  if (rawPage === undefined || rawPageSize === undefined) {
    res.status(400).json({ error: "page and pageSize must be numeric" })
    return
  }

  const filters = extractFilters(req.query as Record<string, unknown>)
  const path = parseGroupPath(req.query.path)
  const { clause, params } = buildAutoInfracaoWhere(filters)

  const pathConditions: string[] = []
  for (const segment of path) {
    const column = GROUP_COLUMN_EXPR[segment.key as GroupKey]
    if (segment.value === null) {
      pathConditions.push(`${column} IS NULL`)
      continue
    }
    params.push(segment.value)
    pathConditions.push(`${column} = $${params.length}`)
  }

  const conditions = [clause.replace(/^WHERE /, ""), ...pathConditions].filter(Boolean)
  const fullClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const page = Math.max(1, rawPage)
  const pageSize = Math.min(100, Math.max(1, rawPageSize))
  const offset = (page - 1) * pageSize

  const countResult = await pool.query(`SELECT COUNT(*) FROM ${GOLD_STAR_FROM} ${fullClause}`, params)
  const total = Number(countResult.rows[0].count)

  const listResult = await pool.query(
    `SELECT
       ROW_NUMBER() OVER (ORDER BY ai.data_hora DESC NULLS LAST) AS id,
       ${LIST_COLUMNS_SQL}
     FROM ${GOLD_STAR_FROM}
     ${fullClause}
     ORDER BY ai.data_hora DESC NULLS LAST
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset]
  )

  res.json({ total, page, pageSize, rows: listResult.rows })
})

async function fetchExportRows(filters: AutoInfracaoFilters, groupBy: GroupKey[]) {
  const { clause, params } = buildAutoInfracaoWhere(filters)
  const orderBy = [...groupBy.map((key) => `"${key}" ASC`), `"data_hora" DESC`].join(", ")
  const dateGroupCols = groupBy.filter((key) => DATE_GROUP_KEYS.has(key))
  const extraSelectCols = dateGroupCols.map((key) => `, ${GROUP_COLUMN_EXPR[key]} AS ${key}`).join("")

  const listResult = await pool.query(
    `SELECT
       ${LIST_COLUMNS_SQL}${extraSelectCols}
     FROM ${GOLD_STAR_FROM}
     ${clause}
     ORDER BY ${orderBy}`,
    params
  )

  return listResult.rows as Record<string, unknown>[]
}

autosInfracaoRouter.get("/api/autos-infracao/export", requirePermission("autos.export"), async (req, res) => {
  const filters = extractFilters(req.query as Record<string, unknown>)
  const groupBy = parseGroupBy(req.query as Record<string, unknown>)
  const rows = await fetchExportRows(filters, groupBy)

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Autos de Infração")
  const headerRow = sheet.addRow(EXPORT_COLUMNS.map((c) => c.header))
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF57889C" } }
  sheet.columns.forEach((column) => {
    column.width = 22
  })

  writeRows(sheet, rows, groupBy, 0)

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
  res.setHeader("Content-Disposition", 'attachment; filename="autos-infracao.xlsx"')
  await workbook.xlsx.write(res)
  res.end()
})

const PDF_ROW_HEIGHT = 16
const PDF_COLUMN_WEIGHTS: Record<ExportColumnKey, number> = {
  numero_auto: 1,
  data_hora: 1.3,
  agente: 1.5,
  codigo: 1.1,
  local: 1.6,
  tipo: 0.9,
  equipamento: 1.1,
  periodo: 0.8,
  competencia: 1.3,
  motivo_cancelamento: 1.6,
  status: 1,
}

function computePdfColumnWidths(usableWidth: number): number[] {
  const weights = EXPORT_COLUMNS.map((c) => PDF_COLUMN_WEIGHTS[c.key])
  const total = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => (w / total) * usableWidth)
}

function truncateToWidth(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string {
  if (doc.widthOfString(text) <= maxWidth) return text
  let result = text
  while (result.length > 1 && doc.widthOfString(`${result}…`) > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}…`
}

type PdfLayout = { startX: number; columnWidths: number[]; bottom: number }

function drawPdfHeaderRow(doc: PDFKit.PDFDocument, layout: PdfLayout, y: number) {
  const totalWidth = layout.columnWidths.reduce((a, b) => a + b, 0)
  doc.rect(layout.startX, y, totalWidth, PDF_ROW_HEIGHT).fill("#57889C")
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff")
  let x = layout.startX
  EXPORT_COLUMNS.forEach((col, i) => {
    doc.text(truncateToWidth(doc, col.header, layout.columnWidths[i] - 4), x + 2, y + 4, {
      width: layout.columnWidths[i] - 4,
      lineBreak: false,
    })
    x += layout.columnWidths[i]
  })
}

function ensurePdfSpace(doc: PDFKit.PDFDocument, layout: PdfLayout, y: number): number {
  if (y + PDF_ROW_HEIGHT <= layout.bottom) return y
  doc.addPage({ layout: "landscape", margin: 30, size: "A4" })
  drawPdfHeaderRow(doc, layout, doc.page.margins.top)
  return doc.page.margins.top + PDF_ROW_HEIGHT
}

function writePdfRows(
  doc: PDFKit.PDFDocument,
  rows: Record<string, unknown>[],
  groupBy: GroupKey[],
  level: number,
  layout: PdfLayout,
  y: number
): number {
  if (level >= groupBy.length) {
    for (const row of rows) {
      y = ensurePdfSpace(doc, layout, y)
      let x = layout.startX
      doc.font("Helvetica").fontSize(7).fillColor("#111111")
      EXPORT_COLUMNS.forEach((col, i) => {
        const raw =
          col.key === "codigo"
            ? formatExportCodigo(row[col.key] as string | null)
            : col.key === "data_hora"
              ? formatExportDataHora(row[col.key] as string | null)
              : String(row[col.key] ?? "—")
        doc.text(truncateToWidth(doc, raw, layout.columnWidths[i] - 4), x + 2, y + 4, {
          width: layout.columnWidths[i] - 4,
          lineBreak: false,
        })
        x += layout.columnWidths[i]
      })
      y += PDF_ROW_HEIGHT
    }
    return y
  }

  const column = groupBy[level]
  const header = GROUP_HEADER_BY_KEY.get(column)
  for (const group of partitionByColumn(rows, column)) {
    y = ensurePdfSpace(doc, layout, y)
    const label = column === "codigo" ? formatExportCodigo(group.value as string | null) : (group.value ?? "—")
    const totalWidth = layout.columnWidths.reduce((a, b) => a + b, 0)
    doc.rect(layout.startX, y, totalWidth, PDF_ROW_HEIGHT).fill("#E5E7EB")
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#111111")
    doc.text(`${"  ".repeat(level)}${header}: ${label} (${group.rows.length})`, layout.startX + 4, y + 4, {
      width: totalWidth - 8,
      lineBreak: false,
    })
    y += PDF_ROW_HEIGHT
    y = writePdfRows(doc, group.rows, groupBy, level + 1, layout, y)
  }
  return y
}

autosInfracaoRouter.get("/api/autos-infracao/export-pdf", requirePermission("autos.export"), async (req, res) => {
  const filters = extractFilters(req.query as Record<string, unknown>)
  const groupBy = parseGroupBy(req.query as Record<string, unknown>)
  const rows = await fetchExportRows(filters, groupBy)

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", 'attachment; filename="autos-infracao.pdf"')

  const doc = new PDFDocument({ layout: "landscape", margin: 30, size: "A4" })
  doc.pipe(res)

  const layout: PdfLayout = {
    startX: doc.page.margins.left,
    columnWidths: computePdfColumnWidths(
      doc.page.width - doc.page.margins.left - doc.page.margins.right
    ),
    bottom: doc.page.height - doc.page.margins.bottom,
  }

  drawPdfHeaderRow(doc, layout, doc.page.margins.top)
  writePdfRows(doc, rows, groupBy, 0, layout, doc.page.margins.top + PDF_ROW_HEIGHT)

  doc.end()
})

autosInfracaoRouter.get("/api/autos-infracao/suggestions", async (req, res) => {
  const field = typeof req.query.field === "string" ? req.query.field : ""
  const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
  const column = SUGGESTION_FIELDS[field as keyof typeof SUGGESTION_FIELDS]

  if (!column) {
    res.status(400).json({ error: "unsupported suggestion field" })
    return
  }

  if (q.length < 3) {
    res.json({ suggestions: [] })
    return
  }

  const result = await pool.query(
    `SELECT DISTINCT ${column} AS value
     FROM ${GOLD_STAR_FROM}
     WHERE ${column} IS NOT NULL
       AND ${column} ILIKE $1
     ORDER BY value
     LIMIT 10`,
    [`%${q}%`]
  )

  res.json({ suggestions: result.rows.map((row) => row.value) })
})

const MONTH_LABELS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split("-")
  return `${MONTH_LABELS_PT[Number(month) - 1]}/${year.slice(2)}`
}

function shiftYear(value: string, years: number): string {
  const [datePart, timePart] = value.split("T")
  const [year, month, day] = datePart.split("-")
  return `${Number(year) + years}-${month}-${day}T${timePart ?? "00:00"}`
}

autosInfracaoRouter.get("/api/autos-infracao/stats", async (req, res) => {
  const filters = extractFilters(req.query as Record<string, unknown>)
  const { clause, params } = buildAutoInfracaoWhere(filters)
  const periodoData = typeof req.query.periodo_data === "string" ? req.query.periodo_data : undefined

  const cancelamentoClause = clause
    ? `${clause} AND (${MOTIVO_CANCELAMENTO_EXPR} IS NOT NULL)`
    : `WHERE ${MOTIVO_CANCELAMENTO_EXPR} IS NOT NULL`

  const granularity = resolveGranularity(periodoData, filters.data_inicio, filters.data_fim)
  const bucketExpr = bucketSqlExpression(granularity, DATA_HORA_EXPR)

  const anteriorFilters = {
    ...filters,
    data_inicio: filters.data_inicio ? shiftYear(filters.data_inicio, -1) : undefined,
    data_fim: filters.data_fim ? shiftYear(filters.data_fim, -1) : undefined,
  }
  const { clause: anteriorClause, params: anteriorParams } = buildAutoInfracaoWhere(anteriorFilters)

  const [
    countResult,
    agentResult,
    groupResult,
    numAgentesResult,
    numEquipamentosResult,
    serieResult,
    tipoResult,
    competenciaResult,
    mesAtualResult,
    mesAnteriorResult,
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM ${GOLD_STAR_FROM} ${clause}`, params),
    pool.query(
      `SELECT
       ${AGENTE_EXPR} AS agente,
       COUNT(*) AS total
     FROM ${GOLD_STAR_FROM}
     ${clause}
     GROUP BY agente
     ORDER BY total DESC
     LIMIT 10`,
      params
    ),
    pool.query(
      `SELECT
       ${MOTIVO_CANCELAMENTO_EXPR} AS motivo_cancelamento,
       COUNT(*) AS total
     FROM ${GOLD_STAR_FROM}
     ${cancelamentoClause}
     GROUP BY motivo_cancelamento
     ORDER BY total DESC`,
      params
    ),
    pool.query(`SELECT COUNT(DISTINCT ${AGENTE_EXPR}) FROM ${GOLD_STAR_FROM} ${clause}`, params),
    pool.query(`SELECT COUNT(DISTINCT ${EQUIPAMENTO_EXPR}) FROM ${GOLD_STAR_FROM} ${clause}`, params),
    pool.query(
      `SELECT ${bucketExpr} AS bucket, COUNT(*) AS total FROM ${GOLD_STAR_FROM} ${clause} GROUP BY bucket`,
      params
    ),
    pool.query(
      `SELECT ${TIPO_EXPR} AS tipo, COUNT(*) AS total FROM ${GOLD_STAR_FROM} ${clause} GROUP BY tipo ORDER BY total DESC`,
      params
    ),
    pool.query(
      `SELECT ${COMPETENCIA_EXPR} AS competencia, COUNT(*) AS total FROM ${GOLD_STAR_FROM} ${clause} GROUP BY competencia ORDER BY total DESC`,
      params
    ),
    pool.query(
      `SELECT to_char(ai.data_hora, 'YYYY-MM') AS ym, COUNT(*) AS total FROM ${GOLD_STAR_FROM} ${clause} GROUP BY ym`,
      params
    ),
    pool.query(
      `SELECT to_char(ai.data_hora, 'YYYY-MM') AS ym, COUNT(*) AS total FROM ${GOLD_STAR_FROM} ${anteriorClause} GROUP BY ym`,
      anteriorParams
    ),
  ])

  const countsByBucket = new Map(
    serieResult.rows.map((row) => [formatBucketKey(granularity, row.bucket), Number(row.total)])
  )
  const serieTemporal = generateBuckets(granularity, filters.data_inicio, filters.data_fim).map((bucket) => ({
    bucket,
    total: countsByBucket.get(bucket) ?? 0,
  }))

  const totalByYmAtual = new Map(mesAtualResult.rows.map((row) => [row.ym as string, Number(row.total)]))
  const totalByYmAnterior = new Map(mesAnteriorResult.rows.map((row) => [row.ym as string, Number(row.total)]))
  const porMesComparativo = generateBuckets("mes", filters.data_inicio, filters.data_fim).map((ym) => {
    const [year, month] = ym.split("-")
    const anteriorYm = `${Number(year) - 1}-${month}`
    return {
      mes: formatMonthLabel(ym),
      atual: totalByYmAtual.get(ym) ?? 0,
      anterior: totalByYmAnterior.get(anteriorYm) ?? 0,
    }
  })

  res.json({
    total: Number(countResult.rows[0].count),
    porAgente: agentResult.rows,
    porMotivoCancelamento: groupResult.rows,
    numAgentes: Number(numAgentesResult.rows[0].count),
    numEquipamentos: Number(numEquipamentosResult.rows[0].count),
    serieTemporal,
    porTipo: tipoResult.rows,
    porCompetencia: competenciaResult.rows,
    porMesComparativo,
  })
})
