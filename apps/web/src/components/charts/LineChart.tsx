import { CartesianGrid, Line, LineChart as RechartsLineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ChartProps } from "./types"

export function LineChart({ data, xKey, yKey, config }: ChartProps) {
  const yKeys = Array.isArray(yKey) ? yKey : [yKey]
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <RechartsLineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {yKeys.map((key) => (
          <Line key={key} type="monotone" dataKey={key} stroke={`var(--color-${key})`} strokeWidth={2} dot={false} />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  )
}
