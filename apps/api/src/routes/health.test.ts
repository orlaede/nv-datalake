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
