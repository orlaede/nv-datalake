import { apiRequestResponse } from "./api"

async function downloadExport(
  endpoint: string,
  filters: Record<string, string | undefined>,
  groupBy: string[],
  filename: string
): Promise<void> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value)
  }
  if (groupBy.length) search.set("groupBy", groupBy.join(","))

  const res = await apiRequestResponse(`${endpoint}?${search.toString()}`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportAutosInfracao(
  filters: Record<string, string | undefined>,
  groupBy: string[]
): Promise<void> {
  return downloadExport("/api/autos-infracao/export", filters, groupBy, "autos-infracao.xlsx")
}

export function exportAutosInfracaoPdf(
  filters: Record<string, string | undefined>,
  groupBy: string[]
): Promise<void> {
  return downloadExport("/api/autos-infracao/export-pdf", filters, groupBy, "autos-infracao.pdf")
}
