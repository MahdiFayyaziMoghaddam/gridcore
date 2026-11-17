import { createInterface } from 'node:readline/promises'
import { sql } from '@vercel/postgres'

/** Dev only. Drops tables in dependency order. */
async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question('This will delete all data. Are you sure? (y/n) ')
  rl.close()

  if (answer.trim() !== 'y') {
    console.warn('Aborted.')
    return
  }

  await sql`DROP TABLE IF EXISTS user_sessions`
  await sql`DROP TABLE IF EXISTS sessions`
  await sql`DROP TABLE IF EXISTS users`
  await sql`DROP TABLE IF EXISTS drizzle_migrations`

  console.warn('Database reset.')
  await sql.end()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})