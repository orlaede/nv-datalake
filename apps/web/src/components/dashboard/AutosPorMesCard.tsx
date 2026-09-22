import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChartHorizontal } from "@/components/charts"

export function AutosPorMesCard({
  porMesComparativo,
}: {
  porMesComparativo: { mes: string; atual: number; anterior: number }[]
}) {
  return (
    <Card className="rounded-2xl bg-primary text-primary-foreground shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-primary-foreground">Autos por Mês</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
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
      </CardContent>
    </Card>
  )
}
