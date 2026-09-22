import express from "express"
import cors from "cors"
import { healthRouter } from "./routes/health"
import { autosInfracaoRouter } from "./routes/autosInfracao"
import { authRouter } from "./routes/auth"

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use(healthRouter)
  app.use(authRouter)
  app.use(autosInfracaoRouter)
  return app
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp()
  const port = process.env.PORT ?? 3001
  app.listen(port, () => console.log(`api listening on :${port}`))
}
