import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sessions, userSessions } from '@/lib/db/schema'

export const sessionQueries = {
  async getById(id: string) {
    const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
    return row
  },

  async getByOwner(ownerId: string) {
    return db.select().from(sessions).where(eq(sessions.ownerId, ownerId))
  },

  /** Saved sessions for a user, newest save first. */
  async getSavedByUser(userId: string) {
    return db
      .select({
        id: sessions.id,
        name: sessions.name,
        ownerId: sessions.ownerId,
        zipUrl: sessions.zipUrl,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
        savedAt: userSessions.savedAt,
      })
      .from(userSessions)
      .innerJoin(sessions, eq(sessions.id, userSessions.sessionId))
      .where(eq(userSessions.userId, userId))
      .orderBy(userSessions.savedAt)
  },

  async hasSavedSession(userId: string, sessionId: string) {
    const [row] = await db
      .select({ sessionId: userSessions.sessionId })
      .from(userSessions)
      .where(
        and(eq(userSessions.userId, userId), eq(userSessions.sessionId, sessionId))
      )
      .limit(1)

    return !!row
  },

  async countSavedByUser(userId: string) {
    const rows = await db
      .select({ sessionId: userSessions.sessionId })
      .from(userSessions)
      .where(eq(userSessions.userId, userId))

    return rows.length
  },

  async upsert(data: { id: string; name: string; ownerId: string; zipUrl: string }) {
    const existing = await this.getById(data.id)

    if (existing) {
      return db
        .update(sessions)
        .set({ name: data.name, zipUrl: data.zipUrl, updatedAt: new Date() })
        .where(eq(sessions.id, data.id))
        .returning()
    }

    return db
      .insert(sessions)
      .values({ ...data, createdAt: new Date(), updatedAt: new Date() })
      .returning()
  },

  async saveForUser(userId: string, sessionId: string) {
    const alreadySaved = await this.hasSavedSession(userId, sessionId)

    if (alreadySaved) {
      return db
        .update(userSessions)
        .set({ savedAt: new Date() })
        .where(and(eq(userSessions.userId, userId), eq(userSessions.sessionId, sessionId)))
    }

    return db.insert(userSessions).values({ userId, sessionId, savedAt: new Date() })
  },

  async deleteSavedForUser(userId: string, sessionId: string) {
    return db
      .delete(userSessions)
      .where(and(eq(userSessions.userId, userId), eq(userSessions.sessionId, sessionId)))
  },

  async remove(sessionId: string) {
    return db.delete(sessions).where(eq(sessions.id, sessionId))
  },
}