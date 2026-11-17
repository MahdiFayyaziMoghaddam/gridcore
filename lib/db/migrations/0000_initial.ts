import { sql, type SQL } from 'drizzle-orm'

/** Minimal executor shape so the migration runs against drizzle or a raw client. */
export interface MigrationExecutor {
  execute: (query: SQL) => Promise<unknown>
}

/**
 * Drizzle hand-written migration. Both directions are exported and every
 * statement is idempotent — see AGENTS.md §11.
 */
export async function up(db: MigrationExecutor): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password TEXT,
      github_id VARCHAR(255) UNIQUE,
      google_id VARCHAR(255) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      zip_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_sessions (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      PRIMARY KEY (user_id, session_id)
    )
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS sessions_owner_id_idx ON sessions(owner_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON sessions(created_at)`)
}

export async function down(db: MigrationExecutor): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS user_sessions`)
  await db.execute(sql`DROP TABLE IF EXISTS sessions`)
  await db.execute(sql`DROP TABLE IF EXISTS users`)
}