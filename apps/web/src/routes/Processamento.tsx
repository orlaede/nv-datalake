import { useQuery } from "@tanstack/react-query"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { ChartCard } from "@/components/dashboard/ChartCard"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { ChartDataTable } from "@/components/dashboard/ChartDataTable"
import { FaixaLegend, FaixaTooltip } from "@/components/dashboard/FaixaTooltip"
import { corPendentes } from "@/components/dashboard/faixa-cores"
import { BarChartStacked, BarChartHorizontal } from "@/components/charts"
import { useFilters } from "@/lib/use-filters"
import { apiGet } from "@/lib/api"

type StatsResponse = {
  prazo: number | null
  totalAutos: number
  processados: number
  dentroPrazo: number
  foraPrazo: number
  faixas: {
    rotulo: string
    de: number
    ate: number | null
    total: number
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
  const faixas = data?.faixas ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Processamento" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total de Autos" value={String(data?.totalAutos ?? "—")} />
        <KpiCard label="Autos processados" value={String(data?.processados ?? "—")} />
        <KpiCard label={`Pendentes dentro do prazo (≤ ${prazo} dias)`} value={String(data?.dentroPrazo ?? "—")} />
        <KpiCard label={`Pendentes fora do prazo (> ${prazo} dias)`} value={String(data?.foraPrazo ?? "—")} valueClassName="text-destructive" />
      </div>

      <ChartCard
        title="Autos de Infração não Processados"
        dataTable={
          <ChartDataTable
            caption="Autos de infração não processados por faixa de dias"
            columns={[
              { key: "rotulo", label: "Faixa (dias)" },
              { key: "total", label: "Não processados" },
              { key: "situacao", label: "Prazo" },
            ]}
            rows={faixas.map((f) => ({ ...f, situacao: f.dentroPrazo ? "Dentro do prazo" : "Fora do prazo" }))}
          />
        }
      >
        <BarChartStacked
          data={faixas}
          xKey="rotulo"
          series={[{ key: "total", label: "Não processados", color: "var(--chart-1)" }]}
          totalKey="total"
          topColor={(r) => corPendentes(Boolean(r.dentroPrazo))}
          hatch={(r) => !r.dentroPrazo}
          tooltip={<FaixaTooltip />}
        />
        <FaixaLegend />
      </ChartCard>

      <ChartCard
        title="Autos por Tipo de Retorno"
        dataTable={
          <ChartDataTable
            caption="Autos por tipo de retorno"
            columns={[
              { key: "tipo", label: "Tipo de retorno" },
              { key: "total", label: "Autos" },
            ]}
            rows={retornosData?.retornos ?? []}
          />
        }
      >
        <BarChartHorizontal
          data={retornosData?.retornos ?? []}
          xKey="tipo"
          yKey="total"
          config={{ total: { label: "Autos", color: "var(--chart-1)" } }}
          yAxisWidth={160}
          rowHeight={36}
          showValues
        />
      </ChartCard>
    </div>
  )
}
