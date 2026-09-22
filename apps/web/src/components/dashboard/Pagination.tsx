import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const PAGE_SIZE_OPTIONS = [25, 50, 100]

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const isFirst = page <= 1
  const isLast = page >= pageCount

  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Por página</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger size="sm" aria-label="Itens por página">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Primeira página"
          disabled={isFirst}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={isFirst}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="px-2 text-sm text-muted-foreground">
          Página {page} de {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Próxima página"
          disabled={isLast}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Última página"
          disabled={isLast}
          onClick={() => onPageChange(pageCount)}
        >
          <ChevronsRight />
        </Button>
      </div>
    </div>
  )
}
