import express from "express"
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
  return app
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp()
  const port = process.env.PORT ?? 3001
  app.listen(port, () => console.log(`api listening on :${port}`))
}
