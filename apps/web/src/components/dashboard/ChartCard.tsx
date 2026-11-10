import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export function ChartCard({
  title,
  children,
  className,
  titleClassName,
  contentClassName,
}: {
  title: string
  children: ReactNode
  className?: string
  titleClassName?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn("rounded-2xl shadow-sm", className)}>
      <CardHeader>
        <CardTitle className={cn("text-base", titleClassName)}>{title}</CardTitle>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
