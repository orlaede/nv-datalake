import fs from "node:fs"
import { Pool } from "pg"
import type { PoolConfig } from "pg"
import "dotenv/config"

function getSslConfig(env: NodeJS.ProcessEnv): PoolConfig["ssl"] {
  const mode = (env.PGSSLMODE ?? "require").toLowerCase()
  if (mode === "disable") return false

  if (env.PGSSLROOTCERT) {
    return {
      ca: fs.readFileSync(env.PGSSLROOTCERT, "utf8"),
      rejectUnauthorized: true,
    }
  }

  return { rejectUnauthorized: mode === "verify-ca" || mode === "verify-full" }
}

export function getPoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const ssl = getSslConfig(env)
  if (env.DATABASE_URL) {
    return { connectionString: env.DATABASE_URL, ssl }
  }

  return {
    host: env.DATALAKE_DB_HOST ?? "localhost",
    port: Number(env.DATALAKE_DB_PORT ?? 5432),
    user: env.DATALAKE_DB_USER ?? "postgres",
    password: env.DATALAKE_DB_PASSWORD ?? "postgres",
    database: env.DATALAKE_DB_NAME ?? "nvdatalake",
    ssl,
  }
}

export const pool = new Pool(getPoolConfig())
