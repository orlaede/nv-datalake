import { useId, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export type CheckListOption = { id: string; label: string }

export function CheckListSheet({
  triggerLabel,
  icon,
  title,
  description,
  options,
  selected,
  onToggle,
  onClear,
  clearLabel,
  showOrder = false,
}: {
  triggerLabel: string
  icon?: ReactNode
  title: string
  description?: string
  options: CheckListOption[]
  selected: string[]
  onToggle: (id: string) => void
  onClear: () => void
  clearLabel: string
  showOrder?: boolean
}) {
  const [open, setOpen] = useState(false)
  const baseId = useId()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            {icon}
            {triggerLabel}
          </Button>
        }
      />
      {open && (
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <ul className="flex flex-col gap-1 px-4">
            {options.map((option) => {
              const order = selected.indexOf(option.id)
              const inputId = `${baseId}-${option.id}`
              return (
                <li key={option.id} className="flex items-center gap-2">
                  <input
                    id={inputId}
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={order >= 0}
                    onChange={() => onToggle(option.id)}
                  />
                  <label htmlFor={inputId} className="flex-1 cursor-pointer py-1">
                    {option.label}
                  </label>
                  {showOrder && order >= 0 && (
                    <span
                      className="text-xs font-medium text-muted-foreground"
                      data-testid={`order-${option.id}`}
                    >
                      {order + 1}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="px-4 pb-4">
            <Button type="button" variant="outline" size="sm" onClick={onClear}>
              {clearLabel}
            </Button>
          </div>
        </SheetContent>
      )}
    </Sheet>
  )
}
