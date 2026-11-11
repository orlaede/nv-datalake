export type FaixaBar = {
  rotulo: string
  total: number
  dentroPrazo: boolean
}

// Balão do gráfico de autos não processados por faixa de dias.
export function FaixaTooltip({ active, payload }: { active?: boolean; payload?: { payload: FaixaBar }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="min-w-44 rounded-xl border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <span className="font-semibold">{d.rotulo === "1" ? "1 dia" : `${d.rotulo} dias`}</span>
        <span className="font-mono font-medium tabular-nums">
          {d.total} {d.total === 1 ? "auto" : "autos"}
        </span>
      </div>
      <div className="mt-2 border-t pt-2">
        <span className={d.dentroPrazo ? "text-success-text" : "text-destructive"}>
          {d.dentroPrazo ? "dentro do prazo" : "fora do prazo"}
        </span>
      </div>
    </div>
  )
}

// Legenda: além da cor, "fora do prazo" é hachurado.
export function FaixaLegend() {
  const itens = [
    { label: "Dentro do prazo", style: { backgroundColor: "var(--success)" } },
    {
      label: "Fora do prazo",
      style: {
        backgroundImage: "repeating-linear-gradient(45deg, var(--destructive) 0 3px, var(--card) 3px 5px)",
      },
    },
  ]
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {itens.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-[3px] border border-border" style={i.style} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}
