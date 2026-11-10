import { useQuery } from "@tanstack/react-query"
import { DataTable, type AutoInfracaoRow } from "@/components/dashboard/DataTable"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { useFilters } from "@/lib/use-filters"
import { usePagination } from "@/lib/use-pagination"
import { apiGet } from "@/lib/api"

type ListResponse = {
  total: number
  page: number
  pageSize: number
  rows: {
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
  }[]
}

export function Listagem() {
  const { filters } = useFilters()
  const { page, pageSize, setPage, setPageSize } = usePagination()

  const { data } = useQuery({
    queryKey: ["autos-infracao-list", filters, page, pageSize],
    queryFn: () =>
      apiGet<ListResponse>("/api/autos-infracao", {
        ...filters,
        page: String(page),
        pageSize: String(pageSize),
      }),
  })

  const rows: AutoInfracaoRow[] =
    data?.rows.map((row) => ({
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
    })) ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Listagem de Autos de Infração" />

      <DataTable
        rows={rows}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        filters={filters}
      />
    </div>
  )
}
