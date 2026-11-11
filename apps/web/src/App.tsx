import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Dashboard } from "./routes/Dashboard"
import { Processamento } from "./routes/Processamento"
import { RetornosProcessamento } from "./routes/RetornosProcessamento"
import { Listagem } from "./routes/Listagem"
import { Login } from "./routes/Login"
import { AppShell } from "./components/layout/AppShell"
import { ProtectedRoute } from "./components/auth/ProtectedRoute"
import { UsersAdmin } from "./routes/admin/UsersAdmin"
import { RolesAdmin } from "./routes/admin/RolesAdmin"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/autos" element={<Listagem />} />
          <Route path="/processamento" element={<Processamento />} />
          <Route path="/processamento/retornos" element={<RetornosProcessamento />} />
          <Route path="/admin/usuarios" element={<UsersAdmin />} />
          <Route path="/admin/roles" element={<RolesAdmin />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
