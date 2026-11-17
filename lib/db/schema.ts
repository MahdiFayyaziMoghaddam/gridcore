import { relations, sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    /** bcrypt hash. Nullable — OAuth-only users have no password. */
    password: text('password'),
    githubId: varchar('github_id', { length: 255 }).unique(),
    googleId: varchar('google_id', { length: 255 }).unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    githubIdIdx: uniqueIndex('users_github_id_idx').on(table.githubId),
    googleIdIdx: uniqueIndex('users_google_id_idx').on(table.googleId),
  })
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    ownerId: uuid('owner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /** URL to the saved ZIP in Vercel Blob. Null until the session is saved. */
    zipUrl: text('zip_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    ownerIdIdx: index('sessions_owner_id_idx').on(table.ownerId),
    createdAtIdx: index('sessions_created_at_idx').on(table.createdAt),
  })
)

export const userSessions = pgTable(
  'user_sessions',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sessionId: uuid('session_id')
      .references(() => sessions.id, { onDelete: 'cascade' })
      .notNull(),
    savedAt: timestamp('saved_at').defaultNow().notNull(),
  },
  table => ({
    pk: uniqueIndex('user_sessions_pk').on(table.userId, table.sessionId),
  })
)

export const usersRelations = relations(users, ({ many }) => ({
  ownedSessions: many(sessions),
  savedSessions: many(userSessions),
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  owner: one(users, { fields: [sessions.ownerId], references: [users.id] }),
  users: many(userSessions),
}))

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
  session: one(sessions, { fields: [userSessions.sessionId], references: [sessions.id] }),
}))

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert
export type SessionRow = typeof sessions.$inferSelect
export type NewSessionRow = typeof sessions.$inferInsert
export type UserSessionRow = typeof userSessions.$inferSelect

export { sql }