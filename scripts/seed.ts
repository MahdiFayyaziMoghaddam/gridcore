import { sql } from '@vercel/postgres'
import { drizzle } from 'drizzle-orm/vercel-postgres'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import * as schema from '../lib/db/schema'

const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'password123'
const TEST_SESSION_ID = '123e4567-e89b-12d3-a456-426614174000'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }

  const db = drizzle(sql, { schema })

  await db
    .insert(schema.users)
    .values({
      name: 'Test User',
      email: TEST_EMAIL,
      password: await bcrypt.hash(TEST_PASSWORD, 10),
    })
    .onConflictDoNothing({ target: schema.users.email })

  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, TEST_EMAIL))
    .limit(1)

  if (!user) throw new Error('Seed user was not created')

  await db
    .insert(schema.sessions)
    .values({ id: TEST_SESSION_ID, name: 'Test Session', ownerId: user.id })
    .onConflictDoNothing({ target: schema.sessions.id })

  console.warn(`Seeded ${TEST_EMAIL} / ${TEST_PASSWORD}`)
  await sql.end()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})