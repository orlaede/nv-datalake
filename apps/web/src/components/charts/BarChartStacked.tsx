import type { ReactElement } from "react"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"

export type StackedSeries = { key: string; label: string; color: string }

type Row = Record<string, string | number | boolean | null>

// Barras empilhadas genéricas. `totalKey` rotula o topo de cada barra; `topColor` pinta o último
// segmento por linha (ex.: verde/vermelho); `tooltip` substitui o balão padrão.
export function BarChartStacked({
  data,
  xKey,
  series,
  totalKey,
  topColor,
  tooltip,
  className,
}: {
  data: Row[]
  xKey: string
  series: StackedSeries[]
  totalKey?: string
  topColor?: (row: Row) => string
  tooltip?: ReactElement
  className?: string
}) {
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]))
  return (
    <ChartContainer config={config} className={className ?? "h-64 w-full"}>
      <BarChart data={data} margin={{ top: totalKey ? 20 : 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={tooltip} />
        {series.map((s, i) => {
          const last = i === series.length - 1
          return (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="a"
              fill={`var(--color-${s.key})`}
              radius={last ? [4, 4, 0, 0] : undefined}
            >
              {last && topColor && data.map((d, j) => <Cell key={j} fill={topColor(d)} />)}
              {last && totalKey && (
                <LabelList
                  dataKey={totalKey}
                  position="top"
                  className="fill-foreground text-xs"
                  formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")}
                />
              )}
            </Bar>
          )
        })}
      </BarChart>
    </ChartContainer>
  )
}
