import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { hashPassword } from "../auth/password"
import { pool } from "../db"

function printHelp() {
  console.log("Uso: npm run create-admin")
  console.log("Solicita nome, e-mail e senha e cria o primeiro usuário com a role admin.")
  console.log("A operação é idempotente para o mesmo e-mail.")
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido")
  return email
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp()
    return
  }

  const rl = readline.createInterface({ input, output })
  try {
    const fullName = (await rl.question("Nome completo: ")).trim()
    const email = normalizeEmail(await rl.question("E-mail: "))
    const password = await rl.question("Senha (mínimo 12 caracteres): ")
    if (!fullName) throw new Error("Nome completo é obrigatório")
    if (password.length < 12) throw new Error("A senha deve ter pelo menos 12 caracteres")

    const passwordHash = await hashPassword(password)
    const schemaCheck = await pool.query<{ users_table: string | null; admin_role: string | null }>(
      `SELECT to_regclass('auth.users') AS users_table, to_regclass('auth.roles') AS admin_role`
    )
    if (!schemaCheck.rows[0]?.users_table || !schemaCheck.rows[0]?.admin_role) {
      throw new Error("O schema auth não está aplicado. Execute as migrações antes do bootstrap.")
    }

    await pool.query("BEGIN")
    try {
      const existing = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM auth.users WHERE lower(email) = $1`,
        [email]
      )
      let userId = existing.rows[0]?.user_id
      if (!userId) {
        const inserted = await pool.query<{ user_id: string }>(
          `INSERT INTO auth.users (email, full_name, password_hash)
           VALUES ($1, $2, $3)
           RETURNING user_id`,
          [email, fullName, passwordHash]
        )
        userId = inserted.rows[0].user_id
      }

      await pool.query(
        `INSERT INTO auth.user_roles (user_id, role_id)
         SELECT $1, role_id FROM auth.roles WHERE role_key = 'admin'
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId]
      )
      await pool.query("COMMIT")
      console.log(existing.rows[0] ? "Usuário existente promovido para admin." : "Administrador criado com sucesso.")
    } catch (error) {
      await pool.query("ROLLBACK")
      throw error
    }
  } finally {
    rl.close()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Erro desconhecido"
  console.error(`Não foi possível criar o administrador: ${message}`)
  process.exitCode = 1
})
