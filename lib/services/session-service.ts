import { randomUUID } from 'node:crypto'
import {
  MAX_SAVED_SESSIONS_PER_USER,
  MAX_SESSION_NAME_LENGTH,
  MAX_USERS_PER_SESSION,
  MAX_ZIP_SIZE,
  SESSION_NAME_FALLBACK_PREFIX,
} from '@/lib/constants'
import { sessionQueries } from '@/lib/db/queries/sessions'
import {
  ConflictError,
  FileTooLargeError,
  ForbiddenError,
  NotFoundError,
  SessionLimitError,
  ValidationError,
} from '@/lib/errors'
import { storageService } from '@/lib/storage/blob'
import { markSessionSaved } from '@/lib/websocket/server'
import { state, type ActiveSession } from '@/lib/websocket/state'
import type { SessionRow } from '@/lib/db/schema'

function fallbackName(): string {
  return `${SESSION_NAME_FALLBACK_PREFIX}${Math.random().toString(36).slice(2, 8)}`
}

export async function createActiveSession(
  ownerId: string,
  requestedName?: string
): Promise<ActiveSession> {
  const count = await sessionQueries.countSavedByUser(ownerId)
  if (count >= MAX_SAVED_SESSIONS_PER_USER) {
    throw new SessionLimitError(MAX_SAVED_SESSIONS_PER_USER)
  }

  const name = (requestedName?.trim() || fallbackName()).slice(0, MAX_SESSION_NAME_LENGTH)
  const id = randomUUID()

  const session: ActiveSession = {
    id,
    name,
    ownerId,
    users: new Set([ownerId]),
    isSaved: false,
    createdAt: new Date(),
  }

  state.sessions.set(id, session)
  return session
}

export async function persistSession(
  sessionId: string,
  ownerId: string,
  zipBase64: string
): Promise<void> {
  const active = state.sessions.get(sessionId)
  if (!active) throw new NotFoundError('Session')
  if (active.ownerId !== ownerId) throw new ForbiddenError('Only the session owner can save it')

  const buffer = Buffer.from(zipBase64, 'base64')

  // Second of three size checks (the client already checked, blob checks again).
  if (buffer.byteLength > MAX_ZIP_SIZE) {
    throw new FileTooLargeError(MAX_ZIP_SIZE)
  }

  const savedCount = await sessionQueries.countSavedByUser(ownerId)
  if (!active.isSaved && savedCount >= MAX_SAVED_SESSIONS_PER_USER) {
    throw new SessionLimitError(MAX_SAVED_SESSIONS_PER_USER)
  }

  const zipUrl = await storageService.upload(sessionId, buffer)

  await sessionQueries.upsert({
    id: sessionId,
    name: active.name,
    ownerId,
    zipUrl,
  })
  await sessionQueries.saveForUser(ownerId, sessionId)

  markSessionSaved(sessionId)
}

export async function loadSavedSession(
  sessionId: string,
  userId: string
): Promise<{ session: SessionRow; zip: string }> {
  const session = await sessionQueries.getById(sessionId)
  if (!session) throw new NotFoundError('Session')

  const ownsIt = session.ownerId === userId
  const saved = await sessionQueries.hasSavedSession(userId, sessionId)

  if (!ownsIt && !saved) {
    throw new ForbiddenError('You do not have access to this session')
  }

  const buffer = await storageService.download(sessionId, session.zipUrl)

  return { session, zip: buffer.toString('base64') }
}

export async function deleteSavedSession(sessionId: string, userId: string): Promise<void> {
  const session = await sessionQueries.getById(sessionId)
  if (!session) throw new NotFoundError('Session')

  if (session.ownerId !== userId) {
    throw new ForbiddenError('Only the owner can delete this session')
  }

  if (state.sessions.has(sessionId)) {
    throw new ConflictError('Cannot delete active session')
  }

  await storageService.delete(sessionId)
  await sessionQueries.deleteSavedForUser(userId, sessionId)

  const remainingLinks = await sessionQueries.countSavedByUser(userId)
  if (remainingLinks === 0) {
    await sessionQueries.remove(sessionId)
  }
}

export interface SessionCheck {
  exists: boolean
  isActive: boolean
  userCount: number
  maxUsers: number
  isSaved: boolean
  reason?: string
}

export async function checkSession(sessionId: string): Promise<SessionCheck> {
  const active = state.sessions.get(sessionId)

  if (!active) {
    const saved = await sessionQueries.getById(sessionId).catch(() => undefined)
    if (!saved) return { exists: false, isActive: false, userCount: 0, maxUsers: 0, isSaved: false }

    return {
      exists: true,
      isActive: false,
      userCount: 0,
      maxUsers: 0,
      isSaved: true,
      reason: 'No owner online',
    }
  }

  return {
    exists: true,
    isActive: true,
    userCount: active.users.size,
    maxUsers: MAX_USERS_PER_SESSION,
    isSaved: active.isSaved,
  }
}

export { ValidationError }
