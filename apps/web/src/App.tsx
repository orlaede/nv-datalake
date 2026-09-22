import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Dashboard } from "./routes/Dashboard"
import { Listagem } from "./routes/Listagem"
import { Login } from "./routes/Login"
import { AppShell } from "./components/layout/AppShell"
import { ProtectedRoute } from "./components/auth/ProtectedRoute"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/autos" element={<Listagem />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
