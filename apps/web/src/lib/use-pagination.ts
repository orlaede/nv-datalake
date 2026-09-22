import { useSearchParams } from "react-router-dom"

export const DEFAULT_PAGE_SIZE = 25

export function usePagination() {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get("page")) || 1
  const pageSize = Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    next.set("page", String(nextPage))
    setSearchParams(next)
  }

  function setPageSize(nextPageSize: number) {
    const next = new URLSearchParams(searchParams)
    next.set("pageSize", String(nextPageSize))
    next.set("page", "1")
    setSearchParams(next)
  }

  return { page, pageSize, setPage, setPageSize }
}
