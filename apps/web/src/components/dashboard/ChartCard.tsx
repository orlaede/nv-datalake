import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export function ChartCard({
  title,
  children,
  className,
  titleClassName,
  contentClassName,
  dataTable,
}: {
  title: string
  children: ReactNode
  className?: string
  titleClassName?: string
  contentClassName?: string
  /** Alternativa em tabela para leitores de tela (ver ChartDataTable). */
  dataTable?: ReactNode
}) {
  return (
    <Card className={cn("rounded-2xl shadow-sm", className)}>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className={cn("text-base", titleClassName)}>{title}</CardTitle>
      </CardHeader>
      <CardContent className={contentClassName}>
        <div role="group" aria-label={title} className="contents">
          {children}
          {dataTable}
        </div>
      </CardContent>
    </Card>
  )
}
