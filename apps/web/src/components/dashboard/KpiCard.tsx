import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ReactNode } from "react"

export function KpiCard({
  label,
  value,
  trend,
  trendPositive,
  icon,
}: {
  label: string
  value: string
  trend?: string
  trendPositive?: boolean
  icon?: ReactNode
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        {icon && <span aria-hidden="true" className="text-primary">{icon}</span>}
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tabular-nums">{value}</div>
        {trend && (
          <Badge variant={trendPositive ? "success" : "destructive"} className="mt-1">
            {trend}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}
