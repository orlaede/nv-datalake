import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { DataTable, type AutoInfracaoRow } from "@/components/dashboard/DataTable"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { useFilters } from "@/lib/use-filters"
import { usePagination } from "@/lib/use-pagination"
import { apiGet } from "@/lib/api"

type ListResponse = {
  total: number
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

export function RetornosProcessamento() {
  const { filters } = useFilters()
  const { page, pageSize, setPage, setPageSize } = usePagination()
  const [searchParams] = useSearchParams()
  const retorno = searchParams.get("retorno") ?? ""

  const { data } = useQuery({
    queryKey: ["processamento-retornos-autos", retorno, filters, page, pageSize],
    queryFn: () =>
      apiGet<ListResponse>("/api/processamento/retornos/autos", {
        ...filters,
        retorno,
        page: String(page),
        pageSize: String(pageSize),
      }),
    enabled: retorno !== "",
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
      <PageHeader title="Retornos de Processamento" />
      <p className="text-sm text-muted-foreground">
        {retorno ? (
          <>
            Retorno: <strong className="text-foreground">{retorno}</strong>
          </>
        ) : (
          "Selecione uma barra do gráfico “Retornos de Processamentos sem Sucesso” para ver os autos."
        )}
      </p>

      <DataTable
        rows={rows}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        filters={filters}
        groupable={false}
        exportable={false}
      />
    </div>
  )
}
