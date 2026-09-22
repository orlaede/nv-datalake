import { useState, type ReactNode } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { LayoutDashboard, ListChecks, LogOut, PanelLeftClose, PanelLeftOpen, Settings2, ShieldCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"

const primaryNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.read" },
  { to: "/autos", label: "Listagem", icon: ListChecks, permission: "autos.read" },
]

const settingsNavItems = [
  { to: "/admin/usuarios", label: "Usuários", icon: Users, permission: "users.read" },
  { to: "/admin/roles", label: "Roles", icon: ShieldCheck, permission: "roles.manage" },
]

export function AppShell({ children }: { children?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true)
  const location = useLocation()
  const { user, logout, hasPermission } = useAuth()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-10 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-14 items-center justify-between px-3">
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Central de Dados</div>
              <div className="truncate text-xs text-muted-foreground">Novavia Data</div>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            onClick={() => setCollapsed((value) => !value)}
            className="shrink-0"
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>

        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-2 py-2">
          {primaryNavItems.filter((item) => hasPermission(item.permission)).map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={`${item.to}${location.search}`}
                end={item.to === "/"}
                aria-label={collapsed ? `Abrir ${item.label}` : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center"
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            )
          })}
          {settingsNavItems.some((item) => hasPermission(item.permission)) && (
            <section aria-label="Configurações" className={cn("flex flex-col gap-1", collapsed ? "mt-3 border-t border-sidebar-border pt-3" : "mt-4")}>
              <div className={cn("flex h-7 items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", collapsed && "justify-center px-0")}>
                <Settings2 className="size-3.5 shrink-0" aria-hidden="true" />
                {!collapsed && <span>Configurações</span>}
              </div>
              <div className={cn("flex flex-col gap-1", !collapsed && "pl-2")}>
                {settingsNavItems.filter((item) => hasPermission(item.permission)).map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={`${item.to}${location.search}`}
                      aria-label={collapsed ? `Abrir ${item.label}` : undefined}
                      className={({ isActive }) =>
                        cn(
                          "flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          collapsed && "justify-center"
                        )
                      }
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  )
                })}
              </div>
            </section>
          )}
        </nav>

        <div className={cn("flex items-center gap-2 border-t border-sidebar-border px-2 py-3", collapsed && "justify-center")}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            N
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user?.name ?? "Novavia"}</div>
            </div>
          )}
          {!collapsed && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Sair"
              className="shrink-0"
              onClick={() => void logout()}
            >
              <LogOut className="size-4" />
            </Button>
          )}
        </div>
      </aside>

      <main className={cn("min-h-screen transition-[padding] duration-200 ease-out", collapsed ? "pl-16" : "pl-64")}>
        {children ?? <Outlet />}
      </main>
    </div>
  )
}
