const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001"

export async function apiGet<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const query = search.toString()
  const url = `${API_URL}${path}${query ? `?${query}` : ""}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json()
}
