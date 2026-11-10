import { useQuery } from "@tanstack/react-query"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { ChartCard } from "@/components/dashboard/ChartCard"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { ChartDataTable } from "@/components/dashboard/ChartDataTable"
import { FaixaLegend, FaixaTooltip, corPendentes } from "@/components/dashboard/FaixaTooltip"
import { BarChartStacked, BarChartHorizontal } from "@/components/charts"
import { useFilters } from "@/lib/use-filters"
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
      <PageHeader title="Processamento" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label={`Dentro do prazo (≤ ${prazo} dias)`} value={String(data?.dentroPrazo ?? "—")} />
        <KpiCard label={`Fora do prazo (> ${prazo} dias)`} value={String(data?.foraPrazo ?? "—")} />
      </div>

      <ChartCard
        title="Autos por Faixa de Dias"
        dataTable={
          <ChartDataTable
            caption="Autos por faixa de dias"
            columns={[
              { key: "rotulo", label: "Faixa (dias)" },
              { key: "total", label: "Total" },
              { key: "processados", label: "Processados" },
              { key: "pendentes", label: "Pendentes" },
              { key: "situacao", label: "Prazo" },
            ]}
            rows={faixas.map((f) => ({ ...f, situacao: f.dentroPrazo ? "Dentro do prazo" : "Fora do prazo" }))}
          />
        }
      >
        <BarChartStacked
          data={faixas}
          xKey="rotulo"
          series={[
            { key: "processados", label: "Processados", color: "var(--chart-1)" },
            { key: "pendentes", label: "Pendentes", color: "var(--warning)" },
          ]}
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
