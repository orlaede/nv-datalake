import { Cell, Pie, PieChart } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ChartProps } from "./types"

export function DonutChart({ data, xKey, yKey, config }: ChartProps) {
  const key = Array.isArray(yKey) ? yKey[0] : yKey
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Pie data={data} dataKey={key} nameKey={xKey} innerRadius={60} outerRadius={90} strokeWidth={2}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={`var(--color-${entry[xKey]})`} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
