import { useRef } from "react"
import { PeriodSelector } from "@/components/dashboard/PeriodSelector"
import { FilterDrawer, type FilterDrawerHandle } from "@/components/dashboard/FilterDrawer"

export function FiltersControls() {
  const drawerRef = useRef<FilterDrawerHandle>(null)

  return (
    <>
      <PeriodSelector onCustomSelected={() => drawerRef.current?.open()} />
      <FilterDrawer ref={drawerRef} />
    </>
  )
}
