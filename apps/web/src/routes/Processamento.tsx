import { useQuery } from "@tanstack/react-query"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { ChartCard } from "@/components/dashboard/ChartCard"
import { FiltersControls } from "@/components/dashboard/FiltersControls"
import { ThemeToggle } from "@/components/theme-toggle"
import { BarChartStacked, BarChartRetornos } from "@/components/charts"
import { useFilters, formatPeriodoLabel } from "@/lib/use-filters"
import { apiGet } from "@/lib/api"

type StatsResponse = {
  prazo: number | null
  dentroPrazo: number
  foraPrazo: number
  faixas: {
    rotulo: string
    de: number
    ate: number | null
    total: number
    processados: number
    dentroPrazo: boolean
  }[]
}

export function Processamento() {
  const { filters } = useFilters()

  const { data } = useQuery({
    queryKey: ["processamento-stats", filters],
    queryFn: () => apiGet<StatsResponse>("/api/processamento/stats", filters),
  })

  const { data: retornosData } = useQuery({
    queryKey: ["processamento-retornos", filters],
    queryFn: () => apiGet<{ retornos: { tipo: string; total: number }[] }>("/api/processamento/retornos", filters),
  })

  const prazo = data?.prazo != null ? String(data.prazo) : "—"
  const faixas =
    data?.faixas.map((f) => ({ ...f, pendentes: f.total - f.processados })) ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="shrink-0 text-2xl font-bold">Processamento</h1>
          {formatPeriodoLabel(filters) && (
            <span className="text-sm text-muted-foreground">{formatPeriodoLabel(filters)}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <FiltersControls />
          <ThemeToggle />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label={`Dentro do prazo (≤ ${prazo} dias)`} value={String(data?.dentroPrazo ?? "—")} />
        <KpiCard label={`Fora do prazo (> ${prazo} dias)`} value={String(data?.foraPrazo ?? "—")} />
      </div>

      <ChartCard title="Autos por Faixa de Dias">
        <BarChartStacked data={faixas} />
      </ChartCard>

      <ChartCard title="Autos por Tipo de Retorno">
        <BarChartRetornos data={retornosData?.retornos ?? []} />
      </ChartCard>
    </div>
  )
}
