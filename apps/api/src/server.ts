import express from "express"
import cors from "cors"
import { getAuthConfig } from "./auth/config"
import { authenticateJwt, requirePermission } from "./auth/middleware"
import { healthRouter } from "./routes/health"
import { autosInfracaoRouter } from "./routes/autosInfracao"
import { authRouter } from "./routes/auth"

export function createApp(options: { disableAuth?: boolean } = {}) {
  const app = express()
  app.use(cors({ origin: getAuthConfig().allowedOrigin, credentials: true }))
  app.use(express.json())
  app.use(healthRouter)
  app.use(authRouter)
  if (!options.disableAuth) {
    app.use("/api/autos-infracao", authenticateJwt, requirePermission("autos.read"))
  }
  app.use(autosInfracaoRouter)
  return app
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp()
  const port = process.env.PORT ?? 3001
  app.listen(port, () => console.log(`api listening on :${port}`))
}
