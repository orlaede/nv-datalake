import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ChartProps } from "./types"

export function BarChartHorizontal({
  data,
  xKey,
  yKey,
  config,
  className,
  tickColor,
  yAxisWidth = 120,
}: ChartProps & { className?: string; tickColor?: string; yAxisWidth?: number }) {
  const keys = Array.isArray(yKey) ? yKey : [yKey]
  const tick = { fontSize: 11, ...(tickColor ? { fill: tickColor } : {}) }
  return (
    <ChartContainer config={config} className={className ?? "h-64 w-full"}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={tickColor} strokeOpacity={tickColor ? 0.3 : undefined} />
        <XAxis type="number" tickLine={false} axisLine={false} tick={tick} />
        <YAxis
          dataKey={xKey}
          type="category"
          tickLine={false}
          axisLine={false}
          width={yAxisWidth}
          tick={tick}
          interval={0}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {keys.map((key) => (
          <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={4} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
