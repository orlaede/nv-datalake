import type { ChartConfig } from "@/components/ui/chart"

export type ChartProps = {
  data: Record<string, string | number>[]
  xKey: string
  yKey: string | string[]
  config: ChartConfig
}
