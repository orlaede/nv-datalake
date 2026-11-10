import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"

export type RetornoBar = { tipo: string; total: number }

const config: ChartConfig = {
  total: { label: "Autos", color: "var(--chart-1)" },
}

// Barras horizontais ordenadas, construídas sobre ChartContainer/ChartTooltipContent (shadcn).
export function BarChartRetornos({ data, yAxisWidth = 160 }: { data: RetornoBar[]; yAxisWidth?: number }) {
  const height = Math.max(160, data.length * 36 + 32)
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis
          dataKey="tipo"
          type="category"
          tickLine={false}
          axisLine={false}
          width={yAxisWidth}
          interval={0}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={<ChartTooltipContent hideLabel />}
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={4}>
          <LabelList dataKey="total" position="right" className="fill-foreground text-xs" />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
