import { forwardRef, useImperativeHandle, useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { FilterBar } from "@/components/dashboard/FilterBar"
import { FILTER_KEYS, useFilters } from "@/lib/use-filters"

export type FilterDrawerHandle = {
  open: () => void
}

export const FilterDrawer = forwardRef<FilterDrawerHandle>(function FilterDrawer(_props, ref) {
  const [open, setOpen] = useState(false)
  const { setFilters } = useFilters()

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Abrir filtros">
            <SlidersHorizontal className="size-4" />
          </Button>
        }
      />
      {open && (
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <FilterBar />
            <div className="flex w-full gap-2">
              <Button
                type="button"
                className="flex-1"
                data-testid="apply-filters"
                onClick={() => setOpen(false)}
              >
                Aplicar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                data-testid="clear-filters"
                onClick={() => setFilters(Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])))}
              >
                Limpar
              </Button>
            </div>
          </div>
        </SheetContent>
      )}
    </Sheet>
  )
})
