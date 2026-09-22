import { useEffect, useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiGet } from "@/lib/api"
import { useFilters, type FilterKey } from "@/lib/use-filters"

const COMPETENCIA_OPTIONS = [
  { value: "Municipal/Rodoviário", label: "Municipal/Rodoviário" },
  { value: "Estadual/Rodoviário", label: "Estadual/Rodoviário" },
  { value: "Estadual/Municipal/Rodoviário", label: "Estadual/Municipal/Rodoviário" },
]

const PERIODO_OPTIONS = [
  { value: "Manhã", label: "Manhã" },
  { value: "Tarde", label: "Tarde" },
  { value: "Noite", label: "Noite" },
]

const TIPO_OPTIONS = [
  { value: "Com Abordagem", label: "Com abordagem" },
  { value: "Sem Abordagem", label: "Sem abordagem" },
]

const ALL_OPTION_VALUE = "__todos__"

const AUTOCOMPLETE_FILTERS = ["agente", "local", "codigo", "equipamento", "motivo_cancelamento"] as const

type AutocompleteFilterKey = (typeof AUTOCOMPLETE_FILTERS)[number]

type SuggestionsResponse = {
  suggestions: string[]
}

function AutocompleteFilter({
  filterKey,
  placeholder,
}: {
  filterKey: AutocompleteFilterKey
  placeholder: string
}) {
  const listId = useId()
  const inputId = useId()
  const { filters, setFilter } = useFilters()
  const selectedValue = filters[filterKey] ?? ""
  const [inputValue, setInputValue] = useState(selectedValue)
  const [open, setOpen] = useState(false)
  const search = inputValue.trim()
  const { data } = useQuery({
    queryKey: ["autos-infracao-suggestions", filterKey, search],
    queryFn: () =>
      apiGet<SuggestionsResponse>("/api/autos-infracao/suggestions", {
        field: filterKey,
        q: search,
      }),
    enabled: search.length >= 3,
  })
  const suggestions = data?.suggestions ?? []

  useEffect(() => {
    setInputValue(selectedValue)
  }, [selectedValue])

  function selectSuggestion(suggestion: string) {
    setInputValue(suggestion)
    setFilter(filterKey, suggestion)
    setOpen(false)
  }

  return (
    <div className="relative w-full">
      <Input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && suggestions.length > 0}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          const nextValue = e.target.value
          setInputValue(nextValue)
          if (!nextValue) setFilter(filterKey, "")
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        className="pr-7"
      />
      {inputValue ? (
        <button
          type="button"
          aria-label={`Limpar ${placeholder}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setInputValue("")
            setFilter(filterKey, "")
            setOpen(false)
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      {open && suggestions.length > 0 ? (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={inputId}
          className="absolute left-0 top-9 z-50 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover p-1 text-sm shadow-lg"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              role="option"
              aria-selected={selectedValue === suggestion}
              onMouseDown={(event) => {
                event.preventDefault()
                selectSuggestion(suggestion)
              }}
              className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-popover-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CustomDateRangeFilter() {
  const { filters, setFilters } = useFilters()
  const startId = useId()
  const endId = useId()

  return (
    <div className="col-span-full grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground" htmlFor={startId}>
        Início
        <Input
          id={startId}
          type="datetime-local"
          value={filters.data_inicio ?? ""}
          onChange={(event) =>
            setFilters({ periodo_data: "customizado", data_inicio: event.target.value })
          }
          className="h-8 w-full bg-card text-xs"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground" htmlFor={endId}>
        Fim
        <Input
          id={endId}
          type="datetime-local"
          value={filters.data_fim ?? ""}
          onChange={(event) =>
            setFilters({ periodo_data: "customizado", data_fim: event.target.value })
          }
          className="h-8 w-full bg-card text-xs"
        />
      </label>
    </div>
  )
}

function SelectFilter({
  filterKey,
  placeholder,
  options,
}: {
  filterKey: FilterKey
  placeholder: string
  options: { value: string; label: string }[]
}) {
  const { filters, setFilter } = useFilters()
  const labelByValue: Record<string, string> = { [ALL_OPTION_VALUE]: "Todos" }
  for (const option of options) labelByValue[option.value] = option.label

  return (
    <Select
      value={filters[filterKey] ?? ALL_OPTION_VALUE}
      onValueChange={(value) => setFilter(filterKey, value === ALL_OPTION_VALUE ? "" : value)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {(value: string) => labelByValue[value] ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_OPTION_VALUE}>Todos</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function FilterBar() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <CustomDateRangeFilter />
      <AutocompleteFilter filterKey="agente" placeholder="Agente de trânsito" />
      <AutocompleteFilter filterKey="local" placeholder="Local da infração" />
      <SelectFilter filterKey="tipo" placeholder="Tipo (com/sem abordagem)" options={TIPO_OPTIONS} />
      <AutocompleteFilter filterKey="codigo" placeholder="Código da infração" />
      <AutocompleteFilter filterKey="equipamento" placeholder="Equipamento" />
      <SelectFilter filterKey="periodo" placeholder="Turno" options={PERIODO_OPTIONS} />
      <SelectFilter filterKey="competencia" placeholder="Competência" options={COMPETENCIA_OPTIONS} />
      <AutocompleteFilter filterKey="motivo_cancelamento" placeholder="Motivo de cancelamento" />
    </div>
  )
}
