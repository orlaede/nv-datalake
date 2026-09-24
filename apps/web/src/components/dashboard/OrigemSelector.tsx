import { useQuery } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiGet } from "@/lib/api"
import { useFilters } from "@/lib/use-filters"

const ALL_ORIGENS_VALUE = "__todas_origens__"

type OrigensResponse = {
  origens: string[]
}

export function OrigemSelector() {
  const { filters, setFilter } = useFilters()
  const { data } = useQuery({
    queryKey: ["autos-infracao-origens"],
    queryFn: () => apiGet<OrigensResponse>("/api/autos-infracao/origens", {}),
  })
  const origens = data?.origens ?? []

  const labelByValue: Record<string, string> = { [ALL_ORIGENS_VALUE]: "Todas as origens" }
  for (const origem of origens) labelByValue[origem] = origem

  return (
    <Select
      value={filters.origem ?? ALL_ORIGENS_VALUE}
      onValueChange={(value) =>
        setFilter("origem", !value || value === ALL_ORIGENS_VALUE ? "" : value)
      }
    >
      <SelectTrigger className="bg-card shadow-sm" aria-label="Origem dos dados">
        <SelectValue placeholder="Origem">
          {(value: string) => labelByValue[value] ?? "Todas as origens"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_ORIGENS_VALUE}>Todas as origens</SelectItem>
        {origens.map((origem) => (
          <SelectItem key={origem} value={origem}>
            {origem}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
