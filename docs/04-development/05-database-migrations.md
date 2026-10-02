# GridCore - Database Migrations

## 📋 Overview

Database migrations in GridCore are managed using **Drizzle ORM**. Migrations allow you to version-control your database schema and apply changes safely across different environments (development, staging, production).

---

## 🏗️ Migration Architecture

┌─────────────────────────────────────────────────────────────────────────┐
│ Migration Workflow │
├─────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Development │ │
│ │ 1. Update schema in schema.ts │ │
│ │ 2. Generate migration: npm run db:generate │ │
│ │ 3. Apply migration: npm run db:push │ │
│ │ 4. Test changes │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Staging │ │
│ │ 1. Push migration files to repository │ │
│ │ 2. Deploy to staging │ │
│ │ 3. Apply migrations on staging database │ │
│ │ 4. Test changes in staging environment │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Production │ │
│ │ 1. Deploy to production │ │
│ │ 2. Apply migrations on production database │ │
│ │ 3. Monitor for errors │ │
│ │ 4. Rollback if needed │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Migration Files Structure

lib/db/migrations/
├── 0000_initial.ts # Initial schema
├── 0001_add_github_id.ts # Add GitHub OAuth support
├── 0002_add_google_id.ts # Add Google OAuth support
├── 0003_add_session_name.ts # Add session name field
├── 0004_add_indexes.ts # Add database indexes
├── meta/
│ ├── \_journal.json # Migration journal
│ └── 0000_snapshot.json # Schema snapshots
└── index.ts # Migration runner

text

---

## 🛠️ Migration Commands

### Setup Commands

```json
// package.json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:drop": "drizzle-kit drop",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:reset": "tsx scripts/reset-db.ts",
    "db:seed": "tsx scripts/seed.ts"
  }
}
Usage
bash
# Generate a new migration
npm run db:generate

# Push changes to database (development)
npm run db:push

# Open Drizzle Studio (visual interface)
npm run db:studio

# Drop the database (development only)
npm run db:drop

# Run migrations manually
npm run db:migrate

# Reset database (development only)
npm run db:reset

# Seed database with test data
npm run db:seed
📝 Migration Files
Initial Migration
typescript
// lib/db/migrations/0000_initial.ts
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/vercel-postgres'

export async function up(db: any) {
  // Users table
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

  // Sessions table
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

  // User sessions junction table
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
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_owner_id ON sessions(owner_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
  `)
}

export async function down(db: any) {
  await db.execute(sql`DROP TABLE IF EXISTS user_sessions`)
  await db.execute(sql`DROP TABLE IF EXISTS sessions`)
  await db.execute(sql`DROP TABLE IF EXISTS users`)
}
Add GitHub OAuth Support
typescript
// lib/db/migrations/0001_add_github_id.ts
import { sql } from 'drizzle-orm'

export async function up(db: any) {
  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN github_id VARCHAR(255) UNIQUE
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id)
  `)
}

export async function down(db: any) {
  await db.execute(sql`
    DROP INDEX IF EXISTS idx_users_github_id
  `)

  await db.execute(sql`
    ALTER TABLE users DROP COLUMN github_id
  `)
}
Add Google OAuth Support
typescript
// lib/db/migrations/0002_add_google_id.ts
import { sql } from 'drizzle-orm'

export async function up(db: any) {
  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN google_id VARCHAR(255) UNIQUE
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)
  `)
}

export async function down(db: any) {
  await db.execute(sql`
    DROP INDEX IF EXISTS idx_users_google_id
  `)

  await db.execute(sql`
    ALTER TABLE users DROP COLUMN google_id
  `)
}
Add Session Name Field
typescript
// lib/db/migrations/0003_add_session_name.ts
import { sql } from 'drizzle-orm'

export async function up(db: any) {
  await db.execute(sql`
    ALTER TABLE sessions
    ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT 'New Session'
  `)

  // Update existing sessions with proper names
  await db.execute(sql`
    UPDATE sessions
    SET name = 'Session-' || LEFT(id::text, 8)
    WHERE name IS NULL OR name = 'New Session'
  `)
}

export async function down(db: any) {
  await db.execute(sql`
    ALTER TABLE sessions DROP COLUMN name
  `)
}
Add Indexes for Performance
typescript
// lib/db/migrations/0004_add_indexes.ts
import { sql } from 'drizzle-orm'

export async function up(db: any) {
  // Composite indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_owner_created
    ON sessions(owner_id, created_at DESC)
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_saved
    ON user_sessions(user_id, saved_at DESC)
  `)

  // Partial indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_with_github
    ON users(github_id)
    WHERE github_id IS NOT NULL
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_with_google
    ON users(google_id)
    WHERE google_id IS NOT NULL
  `)
}

export async function down(db: any) {
  await db.execute(sql`
    DROP INDEX IF EXISTS idx_sessions_owner_created
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS idx_user_sessions_user_saved
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS idx_users_with_github
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS idx_users_with_google
  `)
}
🔄 Migration Runner
File: scripts/migrate.ts
typescript
import { migrate } from 'drizzle-orm/vercel-postgres/migrator'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  console.log('🔄 Running migrations...')

  try {
    // Create migrations table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Run migrations
    await migrate(db, {
      migrationsFolder: './lib/db/migrations'
    })

    console.log('✅ Migrations completed successfully')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

main()
🗑️ Database Reset
File: scripts/reset-db.ts
typescript
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  const confirm = await prompt('⚠️ This will delete all data. Are you sure? (y/n) ')

  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Reset cancelled')
    process.exit(0)
  }

  console.log('🔄 Resetting database...')

  try {
    // Drop all tables
    await db.execute(sql`DROP TABLE IF EXISTS user_sessions`)
    await db.execute(sql`DROP TABLE IF EXISTS sessions`)
    await db.execute(sql`DROP TABLE IF EXISTS users`)
    await db.execute(sql`DROP TABLE IF EXISTS drizzle_migrations`)

    console.log('✅ Database reset completed')
    console.log('📝 Run migrations to recreate schema')
  } catch (error) {
    console.error('❌ Reset failed:', error)
    process.exit(1)
  }
}

async function prompt(question: string): Promise<string> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    readline.question(question, (answer: string) => {
      readline.close()
      resolve(answer)
    })
  })
}

main()
🌱 Seed Script
File: scripts/seed.ts
typescript
import { db } from '@/lib/db'
import { users, sessions, userSessions } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/password'

async function main() {
  console.log('🌱 Seeding database...')

  try {
    // Create test user
    const hashedPassword = await hashPassword('password123')

    const [user] = await db.insert(users).values({
      name: 'Test User',
      email: 'test@example.com',
      password: hashedPassword
    }).returning()

    console.log(`✅ Created user: ${user.name}`)

    // Create test session
    const [session] = await db.insert(sessions).values({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Session',
      ownerId: user.id,
      zipUrl: 'https://blob.example.com/test.zip'
    }).returning()

    console.log(`✅ Created session: ${session.name}`)

    // Link user to session
    await db.insert(userSessions).values({
      userId: user.id,
      sessionId: session.id
    })

    console.log(`✅ Linked user to session`)

    console.log('✅ Seeding completed successfully')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

main()
🔍 Migration Best Practices
1. Always Test Migrations
bash
# Test on development database first
npm run db:push

# Verify changes
npm run db:studio

# Then apply to staging
# Then production
2. Use Transaction Blocks
typescript
// ✅ Good: Wrap migrations in transactions
export async function up(db: any) {
  await db.transaction(async (tx: any) => {
    await tx.execute(sql`
      ALTER TABLE users ADD COLUMN new_column TEXT
    `)

    await tx.execute(sql`
      UPDATE users SET new_column = 'default'
    `)
  })
}
3. Handle Rollbacks
typescript
// ✅ Good: Always provide down function
export async function up(db: any) {
  // Add column
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN new_column TEXT
  `)
}

export async function down(db: any) {
  // Remove column
  await db.execute(sql`
    ALTER TABLE users DROP COLUMN new_column
  `)
}
4. Avoid Data Loss
typescript
// ✅ Good: Add column with default value
export async function up(db: any) {
  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN new_column TEXT NOT NULL DEFAULT 'default'
  `)
}

// ❌ Bad: Add NOT NULL without default
export async function up(db: any) {
  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN new_column TEXT NOT NULL  -- Will fail on existing rows
  `)
}
5. Monitor Performance
typescript
// ✅ Good: Add indexes for large tables
export async function up(db: any) {
  // Add index after adding column
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_new_column
    ON users(new_column)
  `)
}
📊 Migration Journal
File: lib/db/migrations/meta/_journal.json
json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1700000000000,
      "tag": "0000_initial",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1700001000000,
      "tag": "0001_add_github_id",
      "breakpoints": true
    },
    {
      "idx": 2,
      "version": "7",
      "when": 1700002000000,
      "tag": "0002_add_google_id",
      "breakpoints": true
    },
    {
      "idx": 3,
      "version": "7",
      "when": 1700003000000,
      "tag": "0003_add_session_name",
      "breakpoints": true
    },
    {
      "idx": 4,
      "version": "7",
      "when": 1700004000000,
      "tag": "0004_add_indexes",
      "breakpoints": true
    }
  ]
}
🚨 Troubleshooting
Migration Failed
bash
# Check error logs
npm run db:push -- --verbose

# Check connection
psql $DATABASE_URL -c "SELECT 1"

# Reset and retry (development only)
npm run db:reset
npm run db:push
Schema Drift
bash
# Check schema diff
drizzle-kit check

# Generate new migration
npm run db:generate

# Apply changes
npm run db:push
Stuck Migration
bash
# Check current migration state
psql $DATABASE_URL -c "SELECT * FROM drizzle_migrations"

# Manually fix migration state
psql $DATABASE_URL -c "DELETE FROM drizzle_migrations WHERE hash = 'hash'"
📝 Environment-Specific Migrations

### Development

```bash
# Auto-push on schema change
npm run db:push

# Reset and reseed
npm run db:reset
npm run db:seed
```

### Staging

```bash
# Manual migrations
npm run db:migrate

# Verify
npm run db:studio
```

### Production

```bash
# Run migrations as part of deployment
# Vercel automatically handles this

# Manual if needed
vercel db push
```

✅ Migration Checklist
□ Schema changes tested on development
□ Migration has both up and down functions
□ Added indexes for performance
□ Handled existing data (defaults, migrations)
□ No data loss risk
□ Migration tested on staging
□ Rollback plan prepared
□ Backups created before production migration
□ Migration run during low-traffic period
Next: Proceed to 05-api/01-websocket-events.md for WebSocket event documentation.
```
