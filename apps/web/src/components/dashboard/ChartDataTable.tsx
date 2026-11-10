type Cell = string | number | boolean | null

// Alternativa em tabela (só para leitores de tela) dos dados de um gráfico.
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: { key: string; label: string }[]
  rows: Record<string, Cell>[]
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <td key={c.key}>{String(row[c.key] ?? "")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
