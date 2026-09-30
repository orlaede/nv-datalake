import express, { type NextFunction, type Request, type Response } from "express"
import cors from "cors"
import { getAuthConfig } from "./auth/config"
import { authenticateJwt, requirePermission } from "./auth/middleware"
import { healthRouter } from "./routes/health"
import { autosInfracaoRouter } from "./routes/autosInfracao"
import { authRouter } from "./routes/auth"
import { adminRouter } from "./routes/admin"

export function createApp(options: { disableAuth?: boolean } = {}) {
  const app = express()
  const allowedOrigins = getAuthConfig().allowedOrigin.split(",").map((origin) => origin.trim()).filter(Boolean)
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin ?? true)
        return
      }
      callback(new Error("Origin não permitido"))
    },
    credentials: true,
  }))
  app.use(express.json())
  app.use(healthRouter)
  app.use(authRouter)
  app.use(adminRouter)
  if (!options.disableAuth) {
    app.use("/api/autos-infracao", authenticateJwt, requirePermission("autos.read"))
  }
  app.use(autosInfracaoRouter)
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Rota não encontrada" })
  })
  app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error)
      return
    }
    console.error(error)
    res.status(500).json({ error: "Erro interno do servidor" })
  })
  return app
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp()
  const port = process.env.PORT ?? 3001
  app.listen(port, () => console.log(`api listening on :${port}`))
}
