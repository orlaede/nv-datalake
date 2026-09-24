import { useRef } from "react"
import { OrigemSelector } from "@/components/dashboard/OrigemSelector"
import { PeriodSelector } from "@/components/dashboard/PeriodSelector"
import { FilterDrawer, type FilterDrawerHandle } from "@/components/dashboard/FilterDrawer"

export function FiltersControls() {
  const drawerRef = useRef<FilterDrawerHandle>(null)

  return (
    <>
      <OrigemSelector />
      <PeriodSelector onCustomSelected={() => drawerRef.current?.open()} />
      <FilterDrawer ref={drawerRef} />
    </>
  )
}
