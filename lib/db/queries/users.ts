import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export const userQueries = {
  async getById(id: string) {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return row
  },

  async getByEmail(email: string) {
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    return row
  },

  async getByGithubId(githubId: string) {
    const [row] = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1)
    return row
  },

  async getByGoogleId(googleId: string) {
    const [row] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1)
    return row
  },

  async create(data: { name: string; email: string; password?: string }) {
    return db.insert(users).values(data).returning()
  },

  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    return db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
  },

  async delete(id: string) {
    return db.delete(users).where(eq(users.id, id))
  },
}