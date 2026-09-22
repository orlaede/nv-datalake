import { apiGet } from "@/lib/api"
import type { AutoInfracaoRow } from "@/components/dashboard/DataTable"

export type GroupNode = {
  value: unknown
  total: number
  children?: GroupNode[]
}

export type GroupPathSegment = { key: string; value: string | null }

type ApiRow = {
  id: number
  data_hora: string
  agente: string
  local: string
  tipo: string
  codigo: string
  numero_auto: string
  equipamento: string
  periodo: string
  competencia: string
  motivo_cancelamento: string | null
  status: string
}

function mapApiRow(row: ApiRow): AutoInfracaoRow {
  return {
    id: row.id,
    dataHora: row.data_hora,
    agente: row.agente,
    local: row.local,
    tipo: row.tipo,
    codigo: row.codigo,
    numeroAuto: row.numero_auto,
    equipamento: row.equipamento,
    periodo: row.periodo,
    competencia: row.competencia,
    motivoCancelamento: row.motivo_cancelamento,
    status: row.status,
  }
}

export async function fetchAutoInfracaoGroups(
  filters: Record<string, string | undefined>,
  groupBy: string[]
): Promise<GroupNode[]> {
  if (!groupBy.length) return []
  const data = await apiGet<{ groups: GroupNode[] }>("/api/autos-infracao/groups", {
    ...filters,
    groupBy: groupBy.join(","),
  })
  return data.groups
}

export async function fetchAutoInfracaoGroupRows(
  filters: Record<string, string | undefined>,
  path: GroupPathSegment[],
  page: number,
  pageSize: number
): Promise<{ total: number; page: number; pageSize: number; rows: AutoInfracaoRow[] }> {
  const data = await apiGet<{ total: number; page: number; pageSize: number; rows: ApiRow[] }>(
    "/api/autos-infracao/group-rows",
    {
      ...filters,
      path: JSON.stringify(path),
      page: String(page),
      pageSize: String(pageSize),
    }
  )
  return { ...data, rows: data.rows.map(mapApiRow) }
}
