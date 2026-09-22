import { useState, type FormEvent } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth"

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
      const from = typeof location.state?.from === "string" ? location.state.from : "/"
      navigate(from, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 shadow-sm">
        <div className="mb-7 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Novavia Data</p>
          <h1 className="text-2xl font-bold">Acessar plataforma</h1>
          <p className="text-sm text-muted-foreground">Use seu e-mail e senha para continuar.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5 text-sm font-medium" htmlFor="login-email">
            E-mail
            <Input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="block space-y-1.5 text-sm font-medium" htmlFor="login-password">
            Senha
            <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  )
}
