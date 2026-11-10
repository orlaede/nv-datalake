import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormDialog } from "@/components/dashboard/FormDialog"
import { PermissionGate, useAuth } from "@/lib/auth"
import { apiRequest, type AuthUser } from "@/lib/api"

type AdminUser = AuthUser & {
  isActive: boolean
  createdAt?: string
  lastLoginAt?: string | null
}

type UsersResponse = { items: AdminUser[]; total: number; page: number; pageSize: number }

const emptyForm = { name: "", email: "", password: "", roles: "consulta" }

export function UsersAdmin() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const [search, setSearch] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const usersQuery = useQuery({
    queryKey: ["admin-users", appliedSearch, page],
    queryFn: () => apiRequest<UsersResponse>(`/api/admin/users?q=${encodeURIComponent(appliedSearch)}&page=${page}&pageSize=20`),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const roles = form.roles.split(",").map((role) => role.trim()).filter(Boolean)
      const body: Record<string, unknown> = { name: form.name, email: form.email, roles }
      if (form.password) body.password = form.password
      if (!editingId) body.password = form.password
      return apiRequest<{ user: AdminUser }>(editingId ? `/api/admin/users/${editingId}` : "/api/admin/users", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      closeDialog()
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async (user: AdminUser) => {
      await apiRequest(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      })
      const result = await apiRequest<{ revoked: number }>(`/api/admin/users/${user.id}/revoke-sessions`, { method: "POST" })
      return result.revoked
    },
    onSuccess: (revoked) => {
      setNotice(`Sessões revogadas: ${revoked}`)
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
  })

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setAppliedSearch(search)
  }

  function submitForm() {
    setNotice(null)
    saveMutation.mutate()
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    saveMutation.reset()
  }

  function newUser() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function editUser(user: AdminUser) {
    setEditingId(user.id)
    setForm({ name: user.name, email: user.email, password: "", roles: user.roles.join(", ") })
    setDialogOpen(true)
  }

  return (
    <PermissionGate permission="users.read" fallback={<p className="p-6 text-sm text-muted-foreground">Você não tem permissão para visualizar usuários.</p>}>
      <div className="flex flex-col gap-6 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administração</p>
            <h1 className="text-2xl font-bold">Usuários</h1>
            <p className="text-sm text-muted-foreground">Gerencie acesso, roles e sessões da plataforma.</p>
          </div>
          {hasPermission("users.manage") && <Button type="button" onClick={newUser}>Novo usuário</Button>}
        </header>

        {hasPermission("users.manage") && (
          <FormDialog
            open={dialogOpen}
            onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
            title={editingId ? "Editar usuário" : "Novo usuário"}
            submitLabel={editingId ? "Salvar alterações" : "Criar usuário"}
            pending={saveMutation.isPending}
            error={saveMutation.error?.message}
            onSubmit={submitForm}
          >
            <label className="space-y-1 text-sm font-medium" htmlFor="user-name">Nome<Input id="user-name" aria-label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label className="space-y-1 text-sm font-medium" htmlFor="user-email">E-mail<Input id="user-email" aria-label="E-mail" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
            <label className="space-y-1 text-sm font-medium" htmlFor="user-password">Senha<Input id="user-password" aria-label="Senha" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editingId} placeholder={editingId ? "Deixe vazio para manter" : undefined} /></label>
            <label className="space-y-1 text-sm font-medium" htmlFor="user-roles">Roles<Input id="user-roles" aria-label="Roles" value={form.roles} onChange={(event) => setForm({ ...form, roles: event.target.value })} /></label>
          </FormDialog>
        )}

        <form aria-label="Busca de usuários" className="flex gap-2" onSubmit={submitSearch}>
          <Input placeholder="Buscar por nome ou e-mail" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button type="submit" variant="outline">Buscar</Button>
        </form>

        {notice && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}
        {usersQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando usuários…</p>}
        {usersQuery.error && <p role="alert" className="text-sm text-destructive">{usersQuery.error.message}</p>}
        {usersQuery.data && (
          usersQuery.data.items.length ? (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Roles</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ações</th></tr></thead>
                <tbody>
                  {usersQuery.data.items.map((user) => (
                    <tr key={user.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3"><div className="font-medium">{user.name}</div><div className="text-xs text-muted-foreground">{user.email}</div></td>
                      <td className="px-4 py-3">{user.roles.join(", ") || "—"}</td>
                      <td className="px-4 py-3">{user.isActive ? "Ativo" : "Inativo"}</td>
                      <td className="flex flex-wrap gap-2 px-4 py-3">
                        {hasPermission("users.manage") && <>
                          <Button type="button" size="sm" variant="outline" onClick={() => editUser(user)}>Editar {user.name}</Button>
                          {user.isActive && <Button type="button" size="sm" variant="destructive" aria-label={`Desativar ${user.name}`} onClick={() => deactivateMutation.mutate(user)}>Desativar</Button>}
                        </>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
        )}
      </div>
    </PermissionGate>
  )
}
