export function corPendentes(dentroPrazo: boolean) {
  return dentroPrazo ? "var(--success)" : "var(--destructive)"
}
