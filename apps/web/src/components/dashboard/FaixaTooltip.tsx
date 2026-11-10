export type FaixaBar = {
  rotulo: string
  total: number
  processados: number
  pendentes: number
  dentroPrazo: boolean
}

export function corPendentes(dentroPrazo: boolean) {
  return dentroPrazo ? "var(--success)" : "var(--destructive)"
}

// Balão do gráfico de faixas de dias do Processamento.
export function FaixaTooltip({ active, payload }: { active?: boolean; payload?: { payload: FaixaBar }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const pct = d.total > 0 ? Math.round((d.processados / d.total) * 100) : 0
  const linhas = [
    { label: "Processados", valor: d.processados, cor: "var(--chart-1)" },
    { label: "Pendentes", valor: d.pendentes, cor: corPendentes(d.dentroPrazo) },
  ]
  return (
    <div className="min-w-44 rounded-xl border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-4 border-b pb-2">
        <span className="font-semibold">{d.rotulo === "1" ? "1 dia" : `${d.rotulo} dias`}</span>
        <span className="text-muted-foreground">
          {d.total} {d.total === 1 ? "auto" : "autos"}
        </span>
      </div>
      <div className="grid gap-1.5">
        {linhas.map((l) => (
          <div key={l.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: l.cor }} />
              {l.label}
            </span>
            <span className="font-mono font-medium tabular-nums">{l.valor}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t pt-2 text-muted-foreground">
        {pct}% processado ·{" "}
        <span className={d.dentroPrazo ? "text-success" : "text-destructive"}>
          {d.dentroPrazo ? "dentro do prazo" : "fora do prazo"}
        </span>
      </div>
    </div>
  )
}
