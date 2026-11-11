import { useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronRight, Columns3, Layers } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckListSheet } from "@/components/dashboard/CheckListSheet"
import { Pagination } from "@/components/dashboard/Pagination"
import { exportAutosInfracao, exportAutosInfracaoPdf } from "@/lib/export"
import { fetchAutoInfracaoGroupRows, fetchAutoInfracaoGroups, type GroupNode, type GroupPathSegment } from "@/lib/groups"

export type AutoInfracaoRow = {
  id: number
  dataHora: string
  agente: string
  local: string
  tipo: string
  codigo: string
  numeroAuto: string
  equipamento: string
  periodo: string
  competencia: string
  motivoCancelamento: string | null
  status: string
}

function formatCodigo(value: string | null): string {
  if (!value || value.length < 2) return value ?? "—"
  return `${value.slice(0, -1)}-${value.slice(-1)}`
}

function formatDataHora(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type ColumnDefinition = {
  id: string
  apiField: string
  label: string
  render: (row: AutoInfracaoRow) => ReactNode
}

const COLUMN_DEFS: ColumnDefinition[] = [
  { id: "numeroAuto", apiField: "numero_auto", label: "Número do Auto", render: (r) => r.numeroAuto },
  { id: "dataHora", apiField: "data_hora", label: "Data/Hora", render: (r) => formatDataHora(r.dataHora) },
  { id: "agente", apiField: "agente", label: "Agente", render: (r) => r.agente },
  { id: "codigo", apiField: "codigo", label: "Código da Infração", render: (r) => formatCodigo(r.codigo) },
  { id: "local", apiField: "local", label: "Local", render: (r) => r.local },
  { id: "tipo", apiField: "tipo", label: "Tipo", render: (r) => r.tipo },
  { id: "equipamento", apiField: "equipamento", label: "Equipamento", render: (r) => r.equipamento },
  { id: "periodo", apiField: "periodo", label: "Turno", render: (r) => r.periodo },
  { id: "competencia", apiField: "competencia", label: "Competência", render: (r) => r.competencia },
  {
    id: "motivoCancelamento",
    apiField: "motivo_cancelamento",
    label: "Motivo Cancelamento",
   
    render: (r) => r.motivoCancelamento ?? "—",
  },
  {
    id: "status",
    apiField: "status",
    label: "Status do Auto",
   
    render: (r) => <Badge variant={r.status === "Válido" ? "success" : "destructive"}>{r.status}</Badge>,
  },
]

const GROUP_OPTIONS = [
  { id: "ano", label: "Ano", apiField: "ano" },
  { id: "mes", label: "Mês", apiField: "mes" },
  { id: "dia", label: "Dia", apiField: "dia" },
  { id: "hora", label: "Hora", apiField: "hora" },
  { id: "diaSemana", label: "Dia da Semana", apiField: "dia_semana" },
  { id: "agente", label: "Agente", apiField: "agente" },
]

const API_FIELD_BY_GROUP = Object.fromEntries(GROUP_OPTIONS.map((o) => [o.id, o.apiField]))
const GROUP_LABEL_BY_ID = Object.fromEntries(GROUP_OPTIONS.map((o) => [o.id, o.label]))

const COLUMNS_STORAGE_KEY = "listagem.colunas"
const ALL_COLUMN_IDS = COLUMN_DEFS.map((c) => c.id)

function loadVisibleColumns(): string[] {
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!raw) return ALL_COLUMN_IDS
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return ALL_COLUMN_IDS
    const valid = ALL_COLUMN_IDS.filter((id) => parsed.includes(id))
    return valid.length > 0 ? valid : ALL_COLUMN_IDS
  } catch {
    return ALL_COLUMN_IDS
  }
}

function saveVisibleColumns(ids: string[]) {
  try {
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // storage indisponível: mantém só em memória
  }
}

function AutoInfracaoRowCells({ row, columns }: { row: AutoInfracaoRow; columns: ColumnDefinition[] }) {
  return (
    <>
      {columns.map((column) => (
        <TableCell key={column.id}>{column.render(row)}</TableCell>
      ))}
    </>
  )
}

function StatusRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-6 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  )
}

function GroupLeafRows({
  filters,
  path,
  columns,
}: {
  filters: Record<string, string | undefined>
  path: GroupPathSegment[]
  columns: ColumnDefinition[]
}) {
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { data, isLoading } = useQuery({
    queryKey: ["autos-infracao-group-rows", filters, path, page],
    queryFn: () => fetchAutoInfracaoGroupRows(filters, path, page, pageSize),
  })

  if (isLoading || !data) {
    return (
      <TableRow>
        <TableCell colSpan={columns.length} className="text-center text-xs text-muted-foreground">
          Carregando…
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      {data.rows.map((row) => (
        <TableRow key={row.id}>
          <AutoInfracaoRowCells row={row} columns={columns} />
        </TableRow>
      ))}
      {data.total > pageSize && (
        <TableRow>
          <TableCell colSpan={columns.length}>
            <div className="flex items-center justify-end gap-2 py-1">
              <span className="text-xs text-muted-foreground">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.total)} de {data.total}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={page * pageSize >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function GroupTreeNode({
  node,
  groupByFields,
  groupAccessors,
  path,
  level,
  filters,
  expandedPaths,
  toggleExpanded,
  columns,
}: {
  node: GroupNode
  groupByFields: string[]
  groupAccessors: string[]
  path: GroupPathSegment[]
  level: number
  filters: Record<string, string | undefined>
  expandedPaths: Set<string>
  toggleExpanded: (key: string) => void
  columns: ColumnDefinition[]
}) {
  const accessor = groupAccessors[level]
  const header = GROUP_LABEL_BY_ID[accessor]
  const segment: GroupPathSegment = {
    key: groupByFields[level],
    value: node.value === null || node.value === undefined ? null : String(node.value),
  }
  const currentPath = [...path, segment]
  const pathKey = JSON.stringify(currentPath)
  const isExpanded = expandedPaths.has(pathKey)
  const isLeafLevel = level === groupByFields.length - 1

  return (
    <>
      <TableRow className="cursor-pointer bg-muted/40" onClick={() => toggleExpanded(pathKey)}>
        <TableCell colSpan={columns.length}>
          <span
            className="inline-flex items-center gap-1"
            style={{ paddingLeft: `${level * 1.25}rem` }}
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <span className="font-medium">{header}:</span>
            {segment.value ?? "—"}
            <span className="text-muted-foreground">({node.total})</span>
          </span>
        </TableCell>
      </TableRow>
      {isExpanded && !isLeafLevel &&
        node.children?.map((child, i) => (
          <GroupTreeNode
            key={i}
            node={child}
            groupByFields={groupByFields}
            groupAccessors={groupAccessors}
            path={currentPath}
            level={level + 1}
            filters={filters}
            expandedPaths={expandedPaths}
            toggleExpanded={toggleExpanded}
            columns={columns}
          />
        ))}
      {isExpanded && isLeafLevel && <GroupLeafRows filters={filters} path={currentPath} columns={columns} />}
    </>
  )
}

export function DataTable({
  rows,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  filters,
  groupable = true,
  exportable = true,
}: {
  /** Desligue `groupable`/`exportable` quando as linhas não vêm dos endpoints de listagem geral. */
  groupable?: boolean
  exportable?: boolean
  rows: AutoInfracaoRow[]
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  filters: Record<string, string | undefined>
}) {
  const [grouping, setGrouping] = useState<string[]>([])
  const [visibleIds, setVisibleIds] = useState<string[]>(loadVisibleColumns)
  const groupByFields = grouping.map((accessor) => API_FIELD_BY_GROUP[accessor])

  // Grupos expandidos valem só para o agrupamento e os filtros atuais: ao mudar um deles, recolhe.
  const resetKey = `${grouping.join(",")}|${JSON.stringify(filters)}`
  const [expanded, setExpanded] = useState<{ key: string; paths: Set<string> }>({ key: resetKey, paths: new Set() })
  const expandedPaths = expanded.key === resetKey ? expanded.paths : new Set<string>()

  function toggleExpanded(pathKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev.key === resetKey ? prev.paths : [])
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
      return { key: resetKey, paths: next }
    })
  }

  const groupsQuery = useQuery({
    queryKey: ["autos-infracao-groups", filters, groupByFields],
    queryFn: () => fetchAutoInfracaoGroups(filters, groupByFields),
    enabled: grouping.length > 0,
  })

  function handleExportExcel() {
    exportAutosInfracao(filters, groupByFields)
  }

  function handleExportPdf() {
    exportAutosInfracaoPdf(filters, groupByFields)
  }

  function toggleGroup(id: string) {
    setGrouping((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))
  }

  function toggleColumn(id: string) {
    setVisibleIds((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
      if (next.length === 0) return prev
      const ordered = ALL_COLUMN_IDS.filter((c) => next.includes(c))
      saveVisibleColumns(ordered)
      return ordered
    })
  }

  function resetColumns() {
    saveVisibleColumns(ALL_COLUMN_IDS)
    setVisibleIds(ALL_COLUMN_IDS)
  }

  const columns = COLUMN_DEFS.filter((c) => visibleIds.includes(c.id))

  const isGrouped = grouping.length > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {groupable && (
            <CheckListSheet
              triggerLabel={grouping.length > 0 ? `Agrupar (${grouping.length})` : "Agrupar"}
              icon={<Layers className="size-4" />}
              title="Agrupar por"
              description="A ordem da seleção define a ordem dos agrupamentos."
              options={GROUP_OPTIONS}
              selected={grouping}
              onToggle={toggleGroup}
              onClear={() => setGrouping([])}
              clearLabel="Limpar"
              showOrder
            />
          )}
          <CheckListSheet
            triggerLabel="Colunas"
            icon={<Columns3 className="size-4" />}
            title="Colunas visíveis"
            description="Ao menos uma coluna deve permanecer visível."
            options={COLUMN_DEFS.map(({ id, label }) => ({ id, label }))}
            selected={visibleIds}
            onToggle={toggleColumn}
            onClear={resetColumns}
            clearLabel="Restaurar padrão"
          />
        </div>
        {exportable && (
          <div className="flex items-center gap-2">
            <Button type="button" onClick={handleExportPdf}>
              Exportar PDF
            </Button>
            <Button type="button" onClick={handleExportExcel}>
              Exportar Excel
            </Button>
          </div>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-primary hover:bg-primary">
            {columns.map((column) => (
              <TableHead key={column.id} className="text-primary-foreground">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="text-xs">
          {isGrouped && groupsQuery.isLoading && (
            <StatusRow colSpan={columns.length}>Carregando…</StatusRow>
          )}
          {isGrouped && groupsQuery.error && (
            <StatusRow colSpan={columns.length}>Erro ao carregar os grupos: {groupsQuery.error.message}</StatusRow>
          )}
          {((isGrouped && groupsQuery.isSuccess && groupsQuery.data.length === 0) || (!isGrouped && rows.length === 0)) && (
            <StatusRow colSpan={columns.length}>Nenhum auto encontrado para os filtros e o período selecionados.</StatusRow>
          )}
          {isGrouped
            ? groupsQuery.data?.map((node, i) => (
                <GroupTreeNode
                  key={i}
                  node={node}
                  groupByFields={groupByFields}
                  groupAccessors={grouping}
                  path={[]}
                  level={0}
                  filters={filters}
                  expandedPaths={expandedPaths}
                  toggleExpanded={toggleExpanded}
                  columns={columns}
                />
              ))
            : rows.map((row) => (
                <TableRow key={row.id}>
                  <AutoInfracaoRowCells row={row} columns={columns} />
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {!isGrouped && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  )
}
