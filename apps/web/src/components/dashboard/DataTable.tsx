import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { ChevronDown, ChevronRight } from "lucide-react"
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

const columns: ColumnDef<AutoInfracaoRow>[] = [
  { accessorKey: "numeroAuto", header: "Número do Auto" },
  {
    accessorKey: "dataHora",
    header: "Data/Hora",
    cell: (ctx) => formatDataHora(ctx.getValue<string>()),
  },
  { accessorKey: "agente", header: "Agente" },
  {
    accessorKey: "codigo",
    header: "Código da Infração",
    cell: (ctx) => formatCodigo(ctx.getValue<string>()),
  },
  { accessorKey: "local", header: "Local" },
  { accessorKey: "tipo", header: "Tipo" },
  { accessorKey: "equipamento", header: "Equipamento" },
  { accessorKey: "periodo", header: "Turno" },
  { accessorKey: "competencia", header: "Competência" },
  {
    accessorKey: "motivoCancelamento",
    header: "Motivo Cancelamento",
    cell: (ctx) => ctx.getValue<string | null>() ?? "—",
  },
  {
    accessorKey: "status",
    header: "Status do Auto",
    cell: (ctx) => {
      const status = ctx.getValue<string>()
      return (
        <Badge variant={status === "Válido" ? "success" : "destructive"}>
          {status}
        </Badge>
      )
    },
  },
]

const DATE_GROUP_OPTIONS = [
  { id: "ano", label: "Ano", apiField: "ano" },
  { id: "mes", label: "Mês", apiField: "mes" },
  { id: "dia", label: "Dia", apiField: "dia" },
  { id: "hora", label: "Hora", apiField: "hora" },
  { id: "semanaAno", label: "Semana do Ano", apiField: "semana_ano" },
  { id: "diaSemana", label: "Dia da Semana", apiField: "dia_semana" },
] as const

const API_FIELD_BY_ACCESSOR: Record<string, string> = {
  numeroAuto: "numero_auto",
  dataHora: "data_hora",
  agente: "agente",
  codigo: "codigo",
  local: "local",
  tipo: "tipo",
  equipamento: "equipamento",
  periodo: "periodo",
  competencia: "competencia",
  motivoCancelamento: "motivo_cancelamento",
  status: "status",
  ...Object.fromEntries(DATE_GROUP_OPTIONS.map((o) => [o.id, o.apiField])),
}

const GROUP_LABEL_BY_ACCESSOR: Record<string, string> = {
  ...Object.fromEntries(
    columns.map((c) => [(c as { accessorKey: string }).accessorKey, c.header as string])
  ),
  ...Object.fromEntries(DATE_GROUP_OPTIONS.map((o) => [o.id, o.label])),
}

function AutoInfracaoRowCells({ row }: { row: AutoInfracaoRow }) {
  return (
    <>
      <TableCell>{row.numeroAuto}</TableCell>
      <TableCell>{formatDataHora(row.dataHora)}</TableCell>
      <TableCell>{row.agente}</TableCell>
      <TableCell>{formatCodigo(row.codigo)}</TableCell>
      <TableCell>{row.local}</TableCell>
      <TableCell>{row.tipo}</TableCell>
      <TableCell>{row.equipamento}</TableCell>
      <TableCell>{row.periodo}</TableCell>
      <TableCell>{row.competencia}</TableCell>
      <TableCell>{row.motivoCancelamento ?? "—"}</TableCell>
      <TableCell>
        <Badge variant={row.status === "Válido" ? "success" : "destructive"}>{row.status}</Badge>
      </TableCell>
    </>
  )
}

function GroupBySelector({
  grouping,
  onGroupingChange,
}: {
  grouping: string[]
  onGroupingChange: (grouping: string[]) => void
}) {
  function toggleColumn(id: string) {
    if (grouping.includes(id)) {
      onGroupingChange(grouping.filter((g) => g !== id))
    } else {
      onGroupingChange([...grouping, id])
    }
  }

  const groupableColumns = columns.filter(
    (column) => (column as { accessorKey: string }).accessorKey !== "numeroAuto"
  )

  const groupButtons: { id: string; label: string }[] = []
  for (const column of groupableColumns) {
    const id = (column as { accessorKey: string }).accessorKey
    groupButtons.push({ id, label: column.header as string })
    if (id === "dataHora") {
      groupButtons.push(...DATE_GROUP_OPTIONS.map(({ id, label }) => ({ id, label })))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Agrupar por:</span>
      {groupButtons.map(({ id, label }) => {
        const order = grouping.indexOf(id)
        return (
          <Button
            key={id}
            type="button"
            variant={order >= 0 ? "default" : "outline"}
            size="sm"
            onClick={() => toggleColumn(id)}
          >
            {order >= 0 ? `${order + 1}. ` : ""}
            {label}
          </Button>
        )
      })}
      {grouping.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onGroupingChange([])}
        >
          Limpar
        </Button>
      )}
    </div>
  )
}

function GroupLeafRows({
  filters,
  path,
}: {
  filters: Record<string, string | undefined>
  path: GroupPathSegment[]
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
          <AutoInfracaoRowCells row={row} />
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
}: {
  node: GroupNode
  groupByFields: string[]
  groupAccessors: string[]
  path: GroupPathSegment[]
  level: number
  filters: Record<string, string | undefined>
  expandedPaths: Set<string>
  toggleExpanded: (key: string) => void
}) {
  const accessor = groupAccessors[level]
  const header = GROUP_LABEL_BY_ACCESSOR[accessor]
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
            {accessor === "dataHora" && segment.value ? formatDataHora(segment.value) : segment.value ?? "—"}
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
          />
        ))}
      {isExpanded && isLeafLevel && <GroupLeafRows filters={filters} path={currentPath} />}
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
}: {
  rows: AutoInfracaoRow[]
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  filters: Record<string, string | undefined>
}) {
  const [grouping, setGrouping] = useState<string[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const groupByFields = grouping.map((accessor) => API_FIELD_BY_ACCESSOR[accessor])

  useEffect(() => {
    setExpandedPaths(new Set())
  }, [grouping.join(","), JSON.stringify(filters)])

  function toggleExpanded(pathKey: string) {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
      return next
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

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const isGrouped = grouping.length > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GroupBySelector grouping={grouping} onGroupingChange={setGrouping} />
        <div className="flex items-center gap-2">
          <Button type="button" onClick={handleExportPdf}>
            Exportar PDF
          </Button>
          <Button type="button" onClick={handleExportExcel}>
            Exportar Excel
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-primary hover:bg-primary">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-primary-foreground">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="text-xs">
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
                />
              ))
            : table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  <AutoInfracaoRowCells row={row.original} />
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
