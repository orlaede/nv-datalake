import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/lib/auth"
import { apiRequest } from "@/lib/api"

type AdminRole = { id: string; key: string; name: string; description: string; isActive: boolean; permissions: string[] }
type AdminPermission = { key: string; name: string; description: string }

const emptyForm = { key: "", name: "", description: "", permissions: [] as string[] }

export function RolesAdmin() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const rolesQuery = useQuery({ queryKey: ["admin-roles"], queryFn: () => apiRequest<{ roles: AdminRole[] }>("/api/admin/roles") })
  const permissionsQuery = useQuery({ queryKey: ["admin-permissions"], queryFn: () => apiRequest<{ permissions: AdminPermission[] }>("/api/admin/permissions") })

  const saveMutation = useMutation({
    mutationFn: () => apiRequest<{ role: AdminRole }>(editingId ? `/api/admin/roles/${editingId}` : "/api/admin/roles", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      setForm(emptyForm)
      setEditingId(null)
      void queryClient.invalidateQueries({ queryKey: ["admin-roles"] })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    saveMutation.mutate()
  }

  function togglePermission(key: string) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(key) ? current.permissions.filter((value) => value !== key) : [...current.permissions, key],
    }))
  }

  return (
    <PermissionGate permission="roles.manage" fallback={<p className="p-6 text-sm text-muted-foreground">Você não tem permissão para administrar roles.</p>}>
      <div className="flex flex-col gap-6 p-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administração</p>
          <h1 className="text-2xl font-bold">Roles e permissões</h1>
          <p className="text-sm text-muted-foreground">Defina os conjuntos de funcionalidades disponíveis para cada role.</p>
        </header>

        <form className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2" onSubmit={submit}>
          <label className="space-y-1 text-sm font-medium" htmlFor="role-key">Chave<Input id="role-key" aria-label="Chave" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} required /></label>
          <label className="space-y-1 text-sm font-medium" htmlFor="role-name">Nome<Input id="role-name" aria-label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label className="space-y-1 text-sm font-medium sm:col-span-2" htmlFor="role-description">Descrição<Input id="role-description" aria-label="Descrição" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <fieldset className="space-y-2 sm:col-span-2"><legend className="text-sm font-medium">Permissões</legend><div className="grid gap-2 sm:grid-cols-2">{(permissionsQuery.data?.permissions ?? []).map((permission) => <label key={permission.key} className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={permission.name} checked={form.permissions.includes(permission.key)} onChange={() => togglePermission(permission.key)} />{permission.name}</label>)}</div></fieldset>
          <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={saveMutation.isPending}>{editingId ? "Salvar alterações" : "Criar role"}</Button>{editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm) }}>Cancelar</Button>}</div>
          {saveMutation.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{saveMutation.error.message}</p>}
        </form>

        {rolesQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando roles…</p>}
        {rolesQuery.error && <p role="alert" className="text-sm text-destructive">{rolesQuery.error.message}</p>}
        {rolesQuery.data && (rolesQuery.data.roles.length ? <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Role</th><th className="px-4 py-3">Permissões</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ações</th></tr></thead><tbody>{rolesQuery.data.roles.map((role) => <tr key={role.id} className="border-b border-border last:border-0"><td className="px-4 py-3"><div className="font-medium">{role.name}</div><div className="text-xs text-muted-foreground">{role.key}</div></td><td className="px-4 py-3">{role.permissions.join(", ") || "—"}</td><td className="px-4 py-3">{role.isActive ? "Ativa" : "Inativa"}</td><td className="flex gap-2 px-4 py-3"><Button type="button" size="sm" variant="outline" onClick={() => { setEditingId(role.id); setForm({ key: role.key, name: role.name, description: role.description, permissions: role.permissions }) }}>Editar</Button><Button type="button" size="sm" variant="outline" onClick={() => apiRequest(`/api/admin/roles/${role.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !role.isActive }) }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-roles"] }))}>{role.isActive ? "Desativar" : "Ativar"}</Button></td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma role encontrada.</p>)}
      </div>
    </PermissionGate>
  )
}
