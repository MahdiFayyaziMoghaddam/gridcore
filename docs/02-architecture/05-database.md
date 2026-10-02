# GridCore - Database Architecture

## 📋 Overview

GridCore uses **PostgreSQL** as its primary database with **Drizzle ORM** for type-safe database operations. The database stores user accounts, session metadata, and saved session references. All file contents are stored in **Vercel Blob Storage** as ZIP files, not in the database.

---

## 🗄️ Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐ ┌─────────────────┐
│ users │ │ sessions │
├─────────────────┤ ├─────────────────┤
│ id (PK) │◄────────│ id (PK) │
│ name │ │ name │
│ email (unique) │ │ owner_id (FK) │
│ password │ │ zip_url │
│ github_id │ │ created_at │
│ google_id │ │ updated_at │
│ created_at │ └─────────────────┘
│ updated_at │ │
└─────────────────┘ │
│ │
│ │
│ ┌────────▼────────┐
│ │ user_sessions │
│ ├─────────────────┤
└──────────────────│ user_id (FK) │
│ session_id (FK) │
│ saved_at │
└─────────────────┘
```

---
```

## 📄 Table Definitions

### File: `lib/db/schema.ts`

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────
// 1. Users Table
// ─────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password'), // Hashed with bcrypt, optional for OAuth
  githubId: varchar('github_id', { length: 255 }).unique(),
  googleId: varchar('google_id', { length: 255 }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  // Indexes for performance
  emailIdx: uniqueIndex('email_idx').on(table.email),
  githubIdIdx: uniqueIndex('github_id_idx').on(table.githubId),
  googleIdIdx: uniqueIndex('google_id_idx').on(table.googleId)
}))

// ─────────────────────────────────────────────────────────────
// 2. Sessions Table
// ─────────────────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerId: uuid('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  zipUrl: text('zip_url'), // URL to Vercel Blob storage
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  // Indexes for performance
  ownerIdIdx: uniqueIndex('owner_id_idx').on(table.ownerId),
  createdAtIdx: uniqueIndex('created_at_idx').on(table.createdAt)
}))

// ─────────────────────────────────────────────────────────────
// 3. User Sessions Junction Table
// ─────────────────────────────────────────────────────────────

export const userSessions = pgTable('user_sessions', {
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  sessionId: uuid('session_id')
    .references(() => sessions.id, { onDelete: 'cascade' })
    .notNull(),
  savedAt: timestamp('saved_at').defaultNow().notNull()
}, (table) => ({
  // Composite primary key
  pk: uniqueIndex('user_session_pk').on(table.userId, table.sessionId)
}))

// ─────────────────────────────────────────────────────────────
// 4. Relations
// ─────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  savedSessions: many(userSessions),
  ownedSessions: many(sessions)
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  owner: one(users, {
    fields: [sessions.ownerId],
    references: [users.id]
  }),
  users: many(userSessions)
}))

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id]
  }),
  session: one(sessions, {
    fields: [userSessions.sessionId],
    references: [sessions.id]
  })
}))
🔌 Database Client
File: lib/db/index.ts
typescript
import { drizzle } from 'drizzle-orm/vercel-postgres'
import { sql } from '@vercel/postgres'
import * as schema from './schema'

// Create database client
export const db = drizzle(sql, { schema })

// Export schema for use in queries
export * from './schema'

// Database connection helper
export async function connectDB() {
  try {
    await sql`SELECT 1`
    console.log('✅ Database connected successfully')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    throw error
  }
}
📊 Database Queries
User Queries
typescript
// lib/db/queries/users.ts
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'

export const userQueries = {
  // Get user by ID
  async getById(id: string) {
    return await db.select().from(users).where(eq(users.id, id)).get()
  },

  // Get user by email
  async getByEmail(email: string) {
    return await db.select().from(users).where(eq(users.email, email)).get()
  },

  // Get user by GitHub ID
  async getByGithubId(githubId: string) {
    return await db.select().from(users).where(eq(users.githubId, githubId)).get()
  },

  // Get user by Google ID
  async getByGoogleId(googleId: string) {
    return await db.select().from(users).where(eq(users.googleId, googleId)).get()
  },

  // Create user
  async create(data: {
    name: string
    email: string
    password?: string
    githubId?: string
    googleId?: string
  }) {
    return await db.insert(users).values(data).returning()
  },

  // Update user
  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    return await db.update(users).set(data).where(eq(users.id, id)).returning()
  },

  // Delete user
  async delete(id: string) {
    return await db.delete(users).where(eq(users.id, id))
  }
}
Session Queries
typescript
// lib/db/queries/sessions.ts
import { db } from '@/lib/db'
import { sessions, userSessions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const sessionQueries = {
  // Get session by ID
  async getById(id: string) {
    return await db.select().from(sessions).where(eq(sessions.id, id)).get()
  },

  // Get sessions by owner
  async getByOwner(ownerId: string) {
    return await db.select().from(sessions).where(eq(sessions.ownerId, ownerId))
  },

  // Get saved sessions for a user
  async getSavedByUser(userId: string) {
    return await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .innerJoin(sessions, eq(sessions.id, userSessions.sessionId))
  },

  // Check if user has saved a session
  async hasSavedSession(userId: string, sessionId: string) {
    const result = await db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.sessionId, sessionId)
      ))
      .get()
    return !!result
  },

  // Count saved sessions for a user
  async countSavedByUser(userId: string) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .get()
    return result?.count || 0
  },

  // Create session
  async create(data: {
    id: string
    name: string
    ownerId: string
    zipUrl?: string
  }) {
    return await db.insert(sessions).values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
  },

  // Save session for user
  async saveForUser(userId: string, sessionId: string) {
    return await db.insert(userSessions).values({
      userId,
      sessionId,
      savedAt: new Date()
    })
  },

  // Delete saved session for user
  async deleteSavedForUser(userId: string, sessionId: string) {
    return await db
      .delete(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.sessionId, sessionId)
      ))
  },

  // Delete session
  async delete(id: string) {
    return await db.delete(sessions).where(eq(sessions.id, id))
  },

  // Update session
  async update(id: string, data: Partial<typeof sessions.$inferInsert>) {
    return await db
      .update(sessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sessions.id, id))
      .returning()
  }
}
🔐 Authentication Queries
typescript
// lib/db/queries/auth.ts
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'

export const authQueries = {
  // Find or create OAuth user
  async findOrCreateOAuthUser(data: {
    provider: 'github' | 'google'
    providerId: string
    email: string
    name: string
  }) {
    // Find existing user
    const existingUser = await db
      .select()
      .from(users)
      .where(
        data.provider === 'github'
          ? eq(users.githubId, data.providerId)
          : eq(users.googleId, data.providerId)
      )
      .get()

    if (existingUser) {
      return existingUser
    }

    // Check if email already exists
    const userWithEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .get()

    if (userWithEmail) {
      // Update existing user with OAuth provider
      const updateData = data.provider === 'github'
        ? { githubId: data.providerId }
        : { googleId: data.providerId }

      return await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userWithEmail.id))
        .returning()
        .get()
    }

    // Create new user
    const newUser = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        [data.provider === 'github' ? 'githubId' : 'googleId']: data.providerId
      })
      .returning()
      .get()

    return newUser
  },

  // Validate email/password
  async validateCredentials(email: string, password: string) {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get()

    if (!user || !user.password) {
      return null
    }

    const isValid = await bcrypt.compare(password, user.password)
    return isValid ? user : null
  },

  // Hash password
  async hashPassword(password: string) {
    return await bcrypt.hash(password, 10)
  }
}
🔄 Migrations
File: drizzle.config.ts
typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  },
  verbose: true,
  strict: true
} satisfies Config
Running Migrations
bash
# Generate migration
npm run db:generate

# Apply migration
npm run db:push

# Open Drizzle Studio
npm run db:studio
Migration Example
typescript
// lib/db/migrations/0000_initial.ts
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/vercel-postgres'

export async function up(db: any) {
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

  // Create indexes
  await db.execute(sql`
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_sessions_owner_id ON sessions(owner_id);
    CREATE INDEX idx_sessions_created_at ON sessions(created_at);
  `)
}

export async function down(db: any) {
  await db.execute(sql`DROP TABLE IF EXISTS user_sessions`)
  await db.execute(sql`DROP TABLE IF EXISTS sessions`)
  await db.execute(sql`DROP TABLE IF EXISTS users`)
}
📊 Database Utilities
Connection Pooling
typescript
// lib/db/pool.ts
import { Pool } from '@vercel/postgres'

const pool = new Pool({
  max: 20, // Max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})

export async function getConnection() {
  return await pool.connect()
}

export async function closePool() {
  await pool.end()
}
Transaction Helper
typescript
// lib/db/transaction.ts
import { db } from '@/lib/db'

export async function withTransaction<T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await callback(tx)
  })
}
Data Validation
typescript
// lib/db/validators.ts
import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().optional(),
  githubId: z.string().optional(),
  googleId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const SessionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  ownerId: z.string().uuid(),
  zipUrl: z.string().url().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
})

export const CreateSessionSchema = SessionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
})
🧹 Database Maintenance
Cleanup Script
typescript
// scripts/cleanup-db.ts
import { db } from '@/lib/db'
import { sessions } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

async function cleanup() {
  console.log('🧹 Cleaning up database...')

  // Delete sessions older than 30 days that have no users
  await db.execute(sql`
    DELETE FROM sessions
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND id NOT IN (
      SELECT session_id FROM user_sessions
    )
  `)

  console.log('✅ Cleanup completed')
}

cleanup().catch(console.error)
Backup Script
typescript
// scripts/backup-db.ts
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `backup-${timestamp}.sql`

  console.log(`📦 Creating backup: ${filename}`)

  await execAsync(
    `pg_dump ${process.env.DATABASE_URL} > ./backups/${filename}`
  )

  console.log('✅ Backup completed')
}

backup().catch(console.error)
📈 Performance Optimization
Indexes
sql
-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_google_id ON users(google_id);

-- Sessions table indexes
CREATE INDEX idx_sessions_owner_id ON sessions(owner_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);

-- User sessions table indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_id ON user_sessions(session_id);
Query Optimization
typescript
// Use specific columns instead of select *
const user = await db
  .select({
    id: users.id,
    name: users.name,
    email: users.email
  })
  .from(users)
  .where(eq(users.id, userId))
  .get()

// Use exists check instead of fetching full object
const exists = await db
  .select({ exists: sql<boolean>`exists(${db.select().from(users).where(eq(users.id, userId))})` })
  .from(users)
  .get()
🔒 Security
SQL Injection Prevention
Drizzle ORM uses parameterized queries by default

All user input is validated before use

Data Encryption
Passwords hashed with bcrypt

No sensitive data stored in plain text

Access Control
Row-level security via application logic

User-specific queries filtered by user ID

📝 Environment Variables
env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gridcore
DATABASE_URL_POOL=postgresql://user:password@localhost:5432/gridcore?pool=10

# For production (Vercel Postgres)
POSTGRES_URL=postgresql://...
POSTGRES_PRISMA_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...
Next: Read 06-storage.md for storage architecture details.
```
