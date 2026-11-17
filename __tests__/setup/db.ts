import { sql } from '@vercel/postgres'
import { drizzle } from 'drizzle-orm/vercel-postgres'
import { up } from '@/lib/db/migrations/0000_initial'
import * as schema from '@/lib/db/schema'

/** Applies the schema to the test database. Safe to run repeatedly. */
export async function setupTestDb(): Promise<void> {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is not set')
  }

  const db = drizzle(sql, { schema })
  await up(db)
}

export async function cleanupTestDb(): Promise<void> {
  await sql`TRUNCATE TABLE user_sessions, sessions, users RESTART IDENTITY CASCADE`
}