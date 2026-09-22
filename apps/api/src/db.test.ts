import { describe, expect, it } from "vitest"
import { getPoolConfig } from "./db"

describe("getPoolConfig", () => {
  it("uses the Data Lake variables with encrypted transport", () => {
    const config = getPoolConfig({
      DATALAKE_DB_HOST: "datalake.example.com",
      DATALAKE_DB_PORT: "5432",
      DATALAKE_DB_USER: "api_user",
      DATALAKE_DB_PASSWORD: "secret",
      DATALAKE_DB_NAME: "bi_viamobile",
      PGSSLMODE: "require",
    })

    expect(config).toMatchObject({
      host: "datalake.example.com",
      port: 5432,
      user: "api_user",
      password: "secret",
      database: "bi_viamobile",
      ssl: { rejectUnauthorized: false },
    })
  })

  it("requires certificate validation when verify-full is configured", () => {
    const config = getPoolConfig({
      DATALAKE_DB_HOST: "datalake.example.com",
      DATALAKE_DB_PORT: "5432",
      DATALAKE_DB_USER: "api_user",
      DATALAKE_DB_PASSWORD: "secret",
      DATALAKE_DB_NAME: "bi_viamobile",
      PGSSLMODE: "verify-full",
    })

    expect(config.ssl).toEqual({ rejectUnauthorized: true })
  })
})
