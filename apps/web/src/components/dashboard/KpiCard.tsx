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
        {icon}
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <Badge variant={trendPositive ? "success" : "destructive"} className="mt-1">
            {trend}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}
