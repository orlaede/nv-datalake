import { Router, type Request } from "express"
import rateLimit from "express-rate-limit"
import { getAuthConfig } from "../auth/config"
import { AuthError, login, logout, refresh } from "../auth/service"
import { clearRefreshCookie, parseRefreshCookie, serializeRefreshCookie } from "../auth/tokens"

function requestContext(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  }
}

function sendAuthError(error: unknown, res: Parameters<Parameters<Router["post"]>[1]>[1]) {
  if (error instanceof AuthError) {
    res.status(error.status).json({ error: error.message })
    return
  }
  res.status(500).json({ error: "Não foi possível concluir a autenticação" })
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde e tente novamente." },
})

export const authRouter = Router()

authRouter.post("/api/auth/login", loginLimiter, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email : ""
  const password = typeof req.body?.password === "string" ? req.body.password : ""
  if (!email || !password) {
    res.status(400).json({ error: "E-mail e senha são obrigatórios" })
    return
  }

  try {
    const result = await login({ email, password }, requestContext(req))
    const config = getAuthConfig()
    res.append("Set-Cookie", serializeRefreshCookie(result.refreshToken, config))
    res.status(200).json({ accessToken: result.accessToken, user: result.user })
  } catch (error) {
    sendAuthError(error, res)
  }
})

authRouter.post("/api/auth/refresh", async (req, res) => {
  const config = getAuthConfig()
  const rawToken = parseRefreshCookie(req.headers.cookie, config)
  if (!rawToken) {
    res.status(401).json({ error: "Sessão inválida" })
    return
  }

  try {
    const result = await refresh(rawToken, requestContext(req))
    res.append("Set-Cookie", serializeRefreshCookie(result.refreshToken, config))
    res.status(200).json({ accessToken: result.accessToken, user: result.user })
  } catch (error) {
    sendAuthError(error, res)
  }
})

authRouter.post("/api/auth/logout", async (req, res) => {
  const config = getAuthConfig()
  try {
    await logout(parseRefreshCookie(req.headers.cookie, config), requestContext(req))
  } finally {
    res.append("Set-Cookie", clearRefreshCookie(config))
    res.status(204).send()
  }
})
