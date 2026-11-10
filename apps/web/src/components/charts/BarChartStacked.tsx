import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"

export type FaixaBar = {
  rotulo: string
  total: number
  processados: number
  pendentes: number
  dentroPrazo: boolean
}

const config: ChartConfig = {
  processados: { label: "Processados", color: "var(--chart-1)" },
  pendentes: { label: "Pendentes", color: "var(--warning)" },
}

function corPendentes(dentroPrazo: boolean) {
  return dentroPrazo ? "var(--success)" : "var(--destructive)"
}

function FaixaTooltip({ active, payload }: { active?: boolean; payload?: { payload: FaixaBar }[] }) {
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

export function BarChartStacked({ data }: { data: FaixaBar[] }) {
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} margin={{ top: 20 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<FaixaTooltip />} />
        <Bar dataKey="processados" stackId="a" fill="var(--color-processados)" />
        <Bar dataKey="pendentes" stackId="a" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.rotulo} fill={corPendentes(d.dentroPrazo)} />
          ))}
          <LabelList
            dataKey="total"
            position="top"
            className="fill-foreground text-xs"
            formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
