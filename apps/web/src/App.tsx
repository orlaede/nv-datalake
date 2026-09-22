import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Dashboard } from "./routes/Dashboard"
import { Listagem } from "./routes/Listagem"
import { AppShell } from "./components/layout/AppShell"

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/autos" element={<Listagem />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
