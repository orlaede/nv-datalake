import { describe, it, expect } from "vitest"
import request from "supertest"
import { createApp } from "../server"

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const app = createApp()
    const res = await request(app).get("/health")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: "ok" })
  })

  it("allows the loopback origin used by the local Vite server", async () => {
    const res = await request(createApp())
      .options("/api/auth/login")
      .set("Origin", "http://127.0.0.1:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type")

    expect(res.status).toBe(204)
    expect(res.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173")
  })
})

describe("erros sempre em JSON", () => {
  it("responde JSON quando a origem não é permitida", async () => {
    const res = await request(createApp())
      .post("/api/auth/login")
      .set("Origin", "http://origem-bloqueada.test")
      .send({ email: "user@example.com", password: "secret" })

    expect(res.status).toBe(500)
    expect(res.headers["content-type"]).toMatch(/application\/json/)
    expect(res.body.error).toEqual(expect.any(String))
  })

  it("responde JSON em rota de API inexistente", async () => {
    const res = await request(createApp()).get("/api/rota-inexistente")

    expect(res.status).toBe(404)
    expect(res.headers["content-type"]).toMatch(/application\/json/)
    expect(res.body.error).toEqual(expect.any(String))
  })
})
