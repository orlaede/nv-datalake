import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
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
  showValues = false,
  rowHeight,
}: ChartProps & {
  className?: string
  tickColor?: string
  yAxisWidth?: number
  /** Mostra o valor à direita de cada barra. */
  showValues?: boolean
  /** Altura por categoria (px); a altura do gráfico acompanha o nº de linhas. */
  rowHeight?: number
}) {
  const keys = Array.isArray(yKey) ? yKey : [yKey]
  const tick = { fontSize: 11, ...(tickColor ? { fill: tickColor } : {}) }
  const style = rowHeight ? { height: Math.max(160, data.length * rowHeight + 32) } : undefined
  return (
    <ChartContainer config={config} className={className ?? (rowHeight ? "w-full" : "h-64 w-full")} style={style}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: showValues ? 40 : 8, top: 4, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} stroke={tickColor} strokeOpacity={tickColor ? 0.3 : undefined} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={tick} />
        <YAxis
          dataKey={xKey}
          type="category"
          tickLine={false}
          axisLine={false}
          width={yAxisWidth}
          tick={tick}
          interval={0}
        />
        <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<ChartTooltipContent />} />
        {keys.map((key) => (
          <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={4}>
            {showValues && <LabelList dataKey={key} position="right" className="fill-foreground text-xs" />}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  )
}
