import { ChartCard } from "@/components/dashboard/ChartCard"
import { ChartDataTable } from "@/components/dashboard/ChartDataTable"
import { BarChartHorizontal } from "@/components/charts"

export function AutosPorMesCard({
  porMesComparativo,
}: {
  porMesComparativo: { mes: string; atual: number; anterior: number }[]
}) {
  return (
    <ChartCard
      title="Autos por Mês"
      contentClassName="flex flex-1 flex-col gap-2"
      dataTable={
        <ChartDataTable
          caption="Autos por mês"
          columns={[
            { key: "mes", label: "Mês" },
            { key: "atual", label: "Período atual" },
            { key: "anterior", label: "Ano anterior" },
          ]}
          rows={porMesComparativo}
        />
      }
    >
      <BarChartHorizontal
        data={porMesComparativo}
        xKey="mes"
        yKey={["atual", "anterior"]}
        config={{
          atual: { label: "Período atual", color: "var(--chart-1)" },
          anterior: { label: "Ano anterior", color: "var(--chart-5)" },
        }}
        className="h-full w-full"
        yAxisWidth={56}
      />
    </ChartCard>
  )
}
