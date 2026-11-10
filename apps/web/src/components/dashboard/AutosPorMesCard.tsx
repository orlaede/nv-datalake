import { ChartCard } from "@/components/dashboard/ChartCard"
import { BarChartHorizontal } from "@/components/charts"

export function AutosPorMesCard({
  porMesComparativo,
}: {
  porMesComparativo: { mes: string; atual: number; anterior: number }[]
}) {
  return (
    <ChartCard
      title="Autos por Mês"
      className="bg-primary text-primary-foreground"
      titleClassName="text-primary-foreground"
      contentClassName="flex flex-1 flex-col gap-2"
    >
      <BarChartHorizontal
        data={porMesComparativo}
        xKey="mes"
        yKey={["atual", "anterior"]}
        config={{
          atual: { label: "Período atual", color: "#ffffff" },
          anterior: { label: "Ano anterior", color: "rgba(255, 255, 255, 0.6)" },
        }}
        className="h-full w-full"
        tickColor="#fff"
        yAxisWidth={56}
      />
    </ChartCard>
  )
}
