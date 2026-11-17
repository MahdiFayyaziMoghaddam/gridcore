import { sql } from '@vercel/postgres'
import { drizzle } from 'drizzle-orm/vercel-postgres'
import { up } from '../lib/db/migrations/0000_initial'
import * as schema from '../lib/db/schema'

/**
 * drizzle-orm 0.29 ships no vercel-postgres migrator, so the runner executes the
 * hand-written migration through the drizzle instance. Idempotent by design.
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }

  await sql`
    CREATE TABLE IF NOT EXISTS drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `

  const db = drizzle(sql, { schema })
  await up(db)

  console.warn('Schema applied.')
  await sql.end()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})