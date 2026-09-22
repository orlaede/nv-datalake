import { useQuery } from "@tanstack/react-query"
import { useNavigate, useLocation } from "react-router-dom"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { ChartCard } from "@/components/dashboard/ChartCard"
import { AutosPorMesCard } from "@/components/dashboard/AutosPorMesCard"
import { FiltersControls } from "@/components/dashboard/FiltersControls"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { LineChart, BarChartVertical } from "@/components/charts"
import { useFilters, formatPeriodoLabel } from "@/lib/use-filters"
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
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="shrink-0 text-2xl font-bold">Dashboard</h1>
          {formatPeriodoLabel(filters) && (
            <span className="text-sm text-muted-foreground">{formatPeriodoLabel(filters)}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <FiltersControls />
          <Button onClick={() => navigate(`/autos${location.search}`)}>Mostrar Dados</Button>
          <ThemeToggle />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total de Autos" value={String(data?.total ?? "—")} />
        <KpiCard label="Número de Agentes" value={String(data?.numAgentes ?? "—")} />
        <KpiCard label="Número de Equipamentos" value={String(data?.numEquipamentos ?? "—")} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ChartCard title="Evolução de Autos" className="sm:col-span-2">
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
        <ChartCard title="Autos por Tipo">
          <BarChartVertical
            data={porTipo}
            xKey="tipo"
            yKey="total"
            config={{ total: { label: "Total", color: "var(--chart-1)" } }}
          />
        </ChartCard>
        <ChartCard title="Autos por Competência">
          <BarChartVertical
            data={porCompetencia}
            xKey="competencia"
            yKey="total"
            config={{ total: { label: "Total", color: "var(--chart-1)" } }}
          />
        </ChartCard>
      </div>
    </div>
  )
}
