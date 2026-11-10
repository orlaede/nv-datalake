import { useQuery } from "@tanstack/react-query"
import { useNavigate, useLocation } from "react-router-dom"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { ChartCard } from "@/components/dashboard/ChartCard"
import { ChartDataTable } from "@/components/dashboard/ChartDataTable"
import { AutosPorMesCard } from "@/components/dashboard/AutosPorMesCard"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { Button } from "@/components/ui/button"
import { FileText, Users, Cpu } from "lucide-react"
import { LineChart, BarChartVertical } from "@/components/charts"
import { useFilters } from "@/lib/use-filters"
import { apiGet } from "@/lib/api"

type StatsResponse = {
  total: number
  numAgentes: number
  numEquipamentos: number
  serieTemporal: { bucket: string; total: number }[]
  porTipo: { tipo: string; total: string }[]
  porCompetencia: { competencia: string; total: string }[]
  porMesComparativo: { mes: string; atual: number; anterior: number }[]
}

export function Dashboard() {
  const { filters } = useFilters()
  const navigate = useNavigate()
  const location = useLocation()

  const { data } = useQuery({
    queryKey: ["autos-infracao-stats", filters],
    queryFn: () => apiGet<StatsResponse>("/api/autos-infracao/stats", filters),
  })

  const serieTemporal = data?.serieTemporal ?? []

  const porTipo =
    data?.porTipo.map((row) => ({
      tipo: row.tipo,
      total: Number(row.total),
    })) ?? []

  const porCompetencia =
    data?.porCompetencia.map((row) => ({
      competencia: row.competencia,
      total: Number(row.total),
    })) ?? []

  const porMesComparativo = data?.porMesComparativo ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Dashboard"
        actions={<Button variant="outline" onClick={() => navigate(`/autos${location.search}`)}>Mostrar Dados</Button>}
      />

      <section aria-labelledby="sec-indicadores" className="flex flex-col gap-3">
        <h2 id="sec-indicadores" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Indicadores
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="Total de Autos" value={String(data?.total ?? "—")} icon={<FileText className="size-4" />} />
          <KpiCard label="Número de Agentes" value={String(data?.numAgentes ?? "—")} icon={<Users className="size-4" />} />
          <KpiCard label="Número de Equipamentos" value={String(data?.numEquipamentos ?? "—")} icon={<Cpu className="size-4" />} />
        </div>
      </section>

      <section aria-labelledby="sec-graficos" className="flex flex-col gap-4">
        <h2 id="sec-graficos" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Gráficos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ChartCard
            title="Evolução de Autos"
            className="sm:col-span-2"
            dataTable={
              <ChartDataTable
                caption="Evolução de autos"
                columns={[{ key: "bucket", label: "Período" }, { key: "total", label: "Total" }]}
                rows={serieTemporal}
              />
            }
          >
            <LineChart
              data={serieTemporal}
              xKey="bucket"
              yKey="total"
              config={{ total: { label: "Total", color: "var(--chart-1)" } }}
            />
          </ChartCard>
          <AutosPorMesCard porMesComparativo={porMesComparativo} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChartCard
            title="Autos por Tipo"
            dataTable={
              <ChartDataTable
                caption="Autos por tipo"
                columns={[{ key: "tipo", label: "Tipo" }, { key: "total", label: "Total" }]}
                rows={porTipo}
              />
            }
          >
            <BarChartVertical
              data={porTipo}
              xKey="tipo"
              yKey="total"
              config={{ total: { label: "Total", color: "var(--chart-1)" } }}
            />
          </ChartCard>
          <ChartCard
            title="Autos por Competência"
            dataTable={
              <ChartDataTable
                caption="Autos por competência"
                columns={[{ key: "competencia", label: "Competência" }, { key: "total", label: "Total" }]}
                rows={porCompetencia}
              />
            }
          >
            <BarChartVertical
              data={porCompetencia}
              xKey="competencia"
              yKey="total"
              config={{ total: { label: "Total", color: "var(--chart-1)" } }}
            />
          </ChartCard>
        </div>
      </section>
    </div>
  )
}
