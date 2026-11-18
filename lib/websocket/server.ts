import { randomUUID } from 'node:crypto'
import { CHAT_COOLDOWN, MAX_USERS_PER_SESSION, SESSION_CLEANUP_INTERVAL } from '@/lib/constants'
import { checkRateLimit, pruneRateLimits } from '@/lib/rate-limit'
import { state, type ActiveSession } from '@/lib/websocket/state'
import { Permission, checkPermission } from '@/lib/websocket/permissions'
import {
  broadcastToSession,
  sendError,
  sendToUser,
  WebSocketErrorCodes,
} from '@/lib/websocket/errors'
import { isSafeFilePath, validateFileName } from '@/lib/file-system/security'
import { getFileName } from '@/lib/file-system/validation'
import { hasSchema, inboundSchemas } from '@/lib/websocket/validation'
import { SOCKET_OPEN, type SocketLike } from '@/lib/websocket/types'
import type { ActivityStatus } from '@/lib/constants'
import type { ClientMessage } from '@/types/websocket'

// ─────────────────────────────────────────────────────────────
// Connection lifecycle
// ─────────────────────────────────────────────────────────────

export function handleConnect(userId: string, socket: SocketLike): void {
  const existing = state.connections.get(userId)
  if (existing && existing.readyState === SOCKET_OPEN) {
    socket.send(
      JSON.stringify({
        type: 'error',
        payload: {
          error: 'You already have GridCore open',
          code: WebSocketErrorCodes.MULTI_TAB_BLOCKED,
        },
        timestamp: Date.now(),
      })
    )
    socket.close?.(4001, 'You already have GridCore open')
    return
  }

  state.connections.set(userId, socket)
}

export function handleDisconnect(userId: string, socket?: SocketLike): void {
  const current = state.connections.get(userId)
  if (socket && current && current !== socket) return

  const sessionId = state.sessionMap.get(userId)
  state.connections.delete(userId)
  state.chatCooldowns.delete(userId)

  if (!sessionId) return

  state.sessionMap.delete(userId)

  const session = state.sessions.get(sessionId)
  if (!session) return

  session.users.delete(userId)

  const wasTempOwner = session.tempOwnerId === userId
  if (wasTempOwner) {
    session.tempOwnerId = undefined
    broadcastToSession(state, sessionId, 'ownership:revoked', {
      userId,
      revokedBy: session.ownerId,
    })
  }

  if (session.ownerId === userId) {
    handleOwnerGone(sessionId, session, 'Main owner disconnected')
    return
  }

  broadcastToSession(state, sessionId, 'user:left', { userId })

  if (session.users.size === 0) {
    state.sessions.delete(sessionId)
  }
}

/** Owner disconnected: hand the session to the temp owner, or close it. */
function handleOwnerGone(sessionId: string, session: ActiveSession, reason: string): void {
  if (session.tempOwnerId && session.users.has(session.tempOwnerId)) {
    broadcastToSession(state, sessionId, 'ownership:transferred', {
      tempOwnerId: session.tempOwnerId,
      reason,
    })
    sendToUser(state.connections, session.tempOwnerId, 'ownership:promoted', {
      sessionId,
      role: 'temp_owner',
      message: `${reason}, you are now in charge`,
    })
    return
  }

  // No temp owner: the session dies even if other users remain.
  if (session.users.size > 0) {
    closeSession(sessionId, `${reason} without temp owner`)
  } else {
    state.sessions.delete(sessionId)
  }
}

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────

export async function handleMessage(raw: unknown, userId: string): Promise<void> {
  const socket = state.connections.get(userId)

  if (!checkRateLimit(userId)) {
    sendError(socket, 'Rate limit exceeded', WebSocketErrorCodes.RATE_LIMIT_EXCEEDED)
    return
  }

  const message = raw as Partial<ClientMessage>
  const type = message?.type

  if (typeof type !== 'string' || !hasSchema(type)) {
    sendError(socket, 'Unknown event type', WebSocketErrorCodes.INVALID_PAYLOAD)
    return
  }

  const result = inboundSchemas[type].safeParse(message.payload)
  if (!result.success) {
    sendError(socket, 'Invalid message format', WebSocketErrorCodes.INVALID_PAYLOAD)
    return
  }

  const payload = result.data as never

  switch (type) {
    case 'join':
      return handleJoin(payload, userId)
    case 'leave':
      return handleLeave(payload, userId)
    case 'diff':
      return handleDiff(payload, userId)
    case 'cursor':
      return handleCursor(payload, userId)
    case 'status':
      return handleStatus(payload, userId)
    case 'chat':
      return handleChat(payload, userId)
    case 'file:create':
      return handleFileCreate(payload, userId)
    case 'file:delete':
      return handleFileDelete(payload, userId)
    case 'file:rename':
      return handleFileRename(payload, userId)
    case 'session:save':
      return handleSessionSave(payload, userId)
    case 'session:close':
      return handleSessionClose(payload, userId)
    case 'session:id-change':
      return handleSessionIdChange(payload, userId)
    case 'ownership:grant':
      return handleOwnershipGrant(payload, userId)
    case 'ownership:revoke':
      return handleOwnershipRevoke(payload, userId)
    case 'send:zip':
      return handleSendZip(payload, userId)
  }
}

// ─────────────────────────────────────────────────────────────
// Session handlers
// ─────────────────────────────────────────────────────────────

interface SessionPayload {
  sessionId: string
}

function requireMember(sessionId: string, userId: string): ActiveSession | undefined {
  const session = state.sessions.get(sessionId)
  if (!session) {
    sendError(
      state.connections.get(userId),
      'Session not found',
      WebSocketErrorCodes.SESSION_NOT_FOUND
    )
    return undefined
  }

  if (!session.users.has(userId)) {
    sendError(
      state.connections.get(userId),
      'User not in session',
      WebSocketErrorCodes.NOT_IN_SESSION
    )
    return undefined
  }

  return session
}

function handleJoin(payload: SessionPayload, userId: string): void {
  const socket = state.connections.get(userId)
  const session = state.sessions.get(payload.sessionId)

  if (!session) {
    sendError(socket, 'Session not found', WebSocketErrorCodes.SESSION_NOT_FOUND)
    return
  }

  if (state.sessionMap.get(userId) === session.id) {
    return // already joined
  }

  if (state.sessionMap.has(userId)) {
    sendError(socket, 'User already in a session', WebSocketErrorCodes.ALREADY_IN_SESSION)
    return
  }

  if (session.users.size >= MAX_USERS_PER_SESSION) {
    sendError(
      socket,
      `Session is full (max ${MAX_USERS_PER_SESSION} users)`,
      WebSocketErrorCodes.SESSION_FULL
    )
    return
  }

  const ownerOnline = state.connections.has(session.ownerId)
  const tempOwnerOnline = session.tempOwnerId ? state.connections.has(session.tempOwnerId) : false

  if (!ownerOnline && !tempOwnerOnline) {
    sendError(
      socket,
      'Session is not active (no owner online)',
      WebSocketErrorCodes.SESSION_INACTIVE
    )
    return
  }

  const isOwnerJoining = userId === session.ownerId
  const previousTempOwnerId =
    isOwnerJoining && session.tempOwnerId && session.tempOwnerId !== session.ownerId
      ? session.tempOwnerId
      : undefined

  session.users.add(userId)
  state.sessionMap.set(userId, session.id)

  // If the main owner rejoins a session under temp-owner stewardship, reclaim control.
  if (previousTempOwnerId) {
    session.tempOwnerId = undefined
    broadcastToSession(state, session.id, 'ownership:reclaimed', {
      ownerId: session.ownerId,
      tempOwnerId: previousTempOwnerId,
      reason: 'Main owner reconnected',
    })
    sendToUser(state.connections, previousTempOwnerId, 'ownership:demoted', {
      sessionId: session.id,
      role: 'user',
      message: 'Main owner reconnected',
    })
  }

  // The server has no files — borrow them from an existing client.
  const providerId = ownerOnline || isOwnerJoining ? session.ownerId : session.tempOwnerId
  if (providerId && providerId !== userId) {
    sendToUser(state.connections, providerId, 'request:zip', { targetUserId: userId })
  }

  sendToUser(state.connections, userId, 'session:state', {
    id: session.id,
    name: session.name,
    ownerId: session.ownerId,
    tempOwnerId: session.tempOwnerId,
    isSaved: session.isSaved,
    createdAt: session.createdAt,
    users: Array.from(session.users)
      .filter(id => state.connections.has(id))
      .map(id => ({ id, name: id, isOnline: true })),
  })

  broadcastToSession(
    state,
    session.id,
    'user:joined',
    { userId, userName: userId },
    [userId] // sender already knows
  )
}

function handleLeave(payload: SessionPayload, userId: string): void {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  session.users.delete(userId)
  state.sessionMap.delete(userId)

  const wasTempOwner = session.tempOwnerId === userId
  if (wasTempOwner) {
    session.tempOwnerId = undefined
    broadcastToSession(state, session.id, 'ownership:revoked', {
      userId,
      revokedBy: session.ownerId,
    })
  }

  if (session.ownerId === userId) {
    handleOwnerGone(session.id, session, 'Main owner left')
    return
  }

  broadcastToSession(state, session.id, 'user:left', { userId })

  if (session.users.size === 0) {
    state.sessions.delete(session.id)
  }
}

function handleSessionSave(payload: SessionPayload, userId: string): void {
  const session = requireMember(payload.sessionId, userId)
  if (!session) return

  const check = checkPermission(payload.sessionId, userId, Permission.SAVE_SESSION)
  if (!check.allowed) {
    sendError(
      state.connections.get(userId),
      check.error ?? 'Only the main owner can save',
      WebSocketErrorCodes.OWNER_REQUIRED
    )
    return
  }

  sendToUser(state.connections, session.ownerId, 'request:save', { sessionId: session.id })
}

function handleSessionClose(payload: SessionPayload & { save?: boolean }, userId: string): void {
  const session = requireMember(payload.sessionId, userId)
  if (!session) return

  const check = checkPermission(payload.sessionId, userId, Permission.CLOSE_SESSION)
  if (!check.allowed) {
    sendError(
      state.connections.get(userId),
      check.error ?? 'Only owners can close the session',
      WebSocketErrorCodes.PERMISSION_DENIED
    )
    return
  }

  // Only the main owner may save; a temp owner closes immediately.
  if (payload.save && session.ownerId === userId) {
    sendToUser(state.connections, session.ownerId, 'request:save', {
      sessionId: session.id,
      closeAfterSave: true,
    })
    return
  }

  closeSession(session.id, `Closed by ${userId}`)
}

function handleSessionIdChange(
  payload: SessionPayload & { newSessionId?: string },
  userId: string
): void {
  const session = requireMember(payload.sessionId, userId)
  if (!session) return

  const check = checkPermission(payload.sessionId, userId, Permission.CHANGE_SESSION_ID)
  if (!check.allowed) {
    sendError(
      state.connections.get(userId),
      check.error ?? 'Only the main owner can change the session ID',
      WebSocketErrorCodes.OWNER_REQUIRED
    )
    return
  }

  // Server picks the ID — a client-supplied value must never become a key.
  const newId = randomUUID()

  state.sessions.delete(session.id)
  const moved: ActiveSession = { ...session, id: newId }
  state.sessions.set(newId, moved)

  for (const memberId of session.users) {
    state.sessionMap.set(memberId, newId)
  }

  broadcastToSession(state, newId, 'session:id-changed', {
    oldSessionId: session.id,
    newSessionId: newId,
  })
}

// ─────────────────────────────────────────────────────────────
// Collaboration handlers (broadcast, exclude sender)
// ─────────────────────────────────────────────────────────────

function handleDiff(
  payload: { sessionId: string; filePath: string; diff: unknown },
  userId: string
): void {
  if (!requireMember(payload.sessionId, userId)) return

  broadcastToSession(
    state,
    payload.sessionId,
    'diff',
    { userId, filePath: payload.filePath, diff: payload.diff },
    [userId]
  )
}

function handleCursor(
  payload: { sessionId: string; filePath: string; position: { line: number; column: number } },
  userId: string
): void {
  if (!requireMember(payload.sessionId, userId)) return

  broadcastToSession(
    state,
    payload.sessionId,
    'cursor',
    { userId, filePath: payload.filePath, position: payload.position },
    [userId]
  )

  broadcastToSession(
    state,
    payload.sessionId,
    'user:cursor',
    { userId, cursor: { filePath: payload.filePath, ...payload.position } },
    [userId]
  )
}

function handleStatus(
  payload: { sessionId: string; filePath: string; status: ActivityStatus },
  userId: string
): void {
  if (!requireMember(payload.sessionId, userId)) return

  broadcastToSession(
    state,
    payload.sessionId,
    'status',
    { userId, filePath: payload.filePath, status: payload.status },
    [userId]
  )

  broadcastToSession(
    state,
    payload.sessionId,
    'user:file',
    { userId, filePath: payload.filePath },
    [userId]
  )
}

// ─────────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────────

function handleChat(payload: { sessionId: string; content: string }, userId: string): void {
  const socket = state.connections.get(userId)

  if (!requireMember(payload.sessionId, userId)) return

  const content = payload.content.trim()
  if (!content) {
    sendError(socket, 'Message cannot be empty', WebSocketErrorCodes.EMPTY_MESSAGE)
    return
  }

  const last = state.chatCooldowns.get(userId)
  if (last && Date.now() - last.getTime() < CHAT_COOLDOWN) {
    sendError(
      socket,
      'Please wait before sending another message',
      WebSocketErrorCodes.CHAT_COOLDOWN
    )
    return
  }

  state.chatCooldowns.set(userId, new Date())

  // Chat includes the sender so every client keeps one ordered list.
  broadcastToSession(state, payload.sessionId, 'chat', {
    userId,
    content,
    timestamp: new Date().toISOString(),
  })
}

// ─────────────────────────────────────────────────────────────
// File operations (owner or temp owner, broadcast to everyone)
// ─────────────────────────────────────────────────────────────

function isValidFilePath(path: string): boolean {
  return isSafeFilePath(path) && validateFileName(getFileName(path))
}

function handleFileCreate(
  payload: { sessionId: string; path: string; content?: string },
  userId: string
): void {
  if (!requireMember(payload.sessionId, userId)) return

  const check = checkPermission(payload.sessionId, userId, Permission.CREATE_FILE)
  if (!check.allowed) {
    sendError(
      state.connections.get(userId),
      check.error ?? 'Only owners can create files',
      WebSocketErrorCodes.PERMISSION_DENIED
    )
    return
  }

  if (!isValidFilePath(payload.path)) {
    sendError(
      state.connections.get(userId),
      'Invalid file path',
      WebSocketErrorCodes.INVALID_PAYLOAD
    )
    return
  }

  broadcastToSession(state, payload.sessionId, 'file:created', {
    userId,
    path: payload.path,
    content: payload.content ?? '',
  })
}

function handleFileDelete(payload: { sessionId: string; path: string }, userId: string): void {
  if (!requireMember(payload.sessionId, userId)) return

  const check = checkPermission(payload.sessionId, userId, Permission.DELETE_FILE)
  if (!check.allowed) {
    sendError(
      state.connections.get(userId),
      check.error ?? 'Only owners can delete files',
      WebSocketErrorCodes.PERMISSION_DENIED
    )
    return
  }

  if (!isValidFilePath(payload.path)) {
    sendError(
      state.connections.get(userId),
      'Invalid file path',
      WebSocketErrorCodes.INVALID_PAYLOAD
    )
    return
  }

  broadcastToSession(state, payload.sessionId, 'file:deleted', {
    userId,
    path: payload.path,
  })
}

function handleFileRename(
  payload: { sessionId: string; oldPath: string; newPath: string },
  userId: string
): void {
  if (!requireMember(payload.sessionId, userId)) return

  const check = checkPermission(payload.sessionId, userId, Permission.RENAME_FILE)
  if (!check.allowed) {
    sendError(
      state.connections.get(userId),
      check.error ?? 'Only owners can rename files',
      WebSocketErrorCodes.PERMISSION_DENIED
    )
    return
  }

  if (!isValidFilePath(payload.oldPath) || !isValidFilePath(payload.newPath)) {
    sendError(
      state.connections.get(userId),
      'Invalid file path',
      WebSocketErrorCodes.INVALID_PAYLOAD
    )
    return
  }

  broadcastToSession(state, payload.sessionId, 'file:renamed', {
    userId,
    oldPath: payload.oldPath,
    newPath: payload.newPath,
  })
}

// ─────────────────────────────────────────────────────────────
// Ownership
// ─────────────────────────────────────────────────────────────

function handleOwnershipGrant(
  payload: { sessionId: string; userId: string },
  grantorId: string
): void {
  const session = requireMember(payload.sessionId, grantorId)
  if (!session) return

  const check = checkPermission(payload.sessionId, grantorId, Permission.GRANT_TEMP_OWNER)
  if (!check.allowed) {
    sendError(
      state.connections.get(grantorId),
      check.error ?? 'Only the main owner can manage temporary ownership',
      WebSocketErrorCodes.PERMISSION_DENIED
    )
    return
  }

  if (!session.users.has(payload.userId)) {
    sendError(
      state.connections.get(grantorId),
      'User is not in session',
      WebSocketErrorCodes.NOT_IN_SESSION
    )
    return
  }

  if (session.tempOwnerId === payload.userId) {
    sendError(
      state.connections.get(grantorId),
      'User is already a temp owner',
      WebSocketErrorCodes.PERMISSION_DENIED
    )
    return
  }

  if (session.tempOwnerId) {
    const previousTempOwnerId = session.tempOwnerId
    session.tempOwnerId = undefined
    broadcastToSession(state, payload.sessionId, 'ownership:revoked', {
      userId: previousTempOwnerId,
      revokedBy: grantorId,
    })
    sendToUser(state.connections, previousTempOwnerId, 'ownership:demoted', {
      sessionId: payload.sessionId,
      role: 'user',
    })
  }

  session.tempOwnerId = payload.userId

  broadcastToSession(state, payload.sessionId, 'ownership:granted', {
    userId: payload.userId,
    grantedBy: grantorId,
  })

  sendToUser(state.connections, payload.userId, 'ownership:promoted', {
    sessionId: payload.sessionId,
    role: 'temp_owner',
  })
}

function handleOwnershipRevoke(payload: { sessionId: string }, userId: string): void {
  const session = requireMember(payload.sessionId, userId)
  if (!session) return

  const check = checkPermission(payload.sessionId, userId, Permission.REVOKE_TEMP_OWNER)
  if (!check.allowed) {
    sendError(
      state.connections.get(userId),
      check.error ?? 'Only the main owner can manage temporary ownership',
      WebSocketErrorCodes.PERMISSION_DENIED
    )
    return
  }

  const tempOwnerId = session.tempOwnerId
  if (!tempOwnerId) {
    sendError(
      state.connections.get(userId),
      'No temp owner to revoke',
      WebSocketErrorCodes.PERMISSION_DENIED
    )
    return
  }

  session.tempOwnerId = undefined

  broadcastToSession(state, payload.sessionId, 'ownership:revoked', {
    userId: tempOwnerId,
    revokedBy: userId,
  })

  sendToUser(state.connections, tempOwnerId, 'ownership:demoted', {
    sessionId: payload.sessionId,
    role: 'user',
  })
}

/** A client answering `request:zip` — relayed straight to the joiner. */
function handleSendZip(
  payload: { targetUserId: string; zip: string; state?: string },
  userId: string
): void {
  const socket = state.connections.get(userId)

  const sessionId = state.sessionMap.get(userId)
  if (!sessionId) {
    sendError(socket, 'You are not in a session', WebSocketErrorCodes.NOT_IN_SESSION)
    return
  }

  const session = state.sessions.get(sessionId)
  if (!session) {
    sendError(socket, 'Session not found', WebSocketErrorCodes.SESSION_NOT_FOUND)
    return
  }

  const targetSessionId = state.sessionMap.get(payload.targetUserId)
  if (!session.users.has(payload.targetUserId) || targetSessionId !== sessionId) {
    sendError(socket, 'Target user is not in this session', WebSocketErrorCodes.NOT_IN_SESSION)
    return
  }

  const providerCheck = checkPermission(sessionId, userId, Permission.SAVE_SESSION)
  if (!providerCheck.allowed && session.tempOwnerId !== userId) {
    sendError(
      socket,
      'Only an authorized session provider can send session state',
      WebSocketErrorCodes.PERMISSION_DENIED
    )
    return
  }

  const target = state.connections.get(payload.targetUserId)
  if (!target || target.readyState !== SOCKET_OPEN) {
    sendError(socket, 'Target user is no longer connected', WebSocketErrorCodes.INTERNAL_ERROR)
    return
  }

  sendToUser(state.connections, payload.targetUserId, 'receive:zip', {
    zip: payload.zip,
    state: payload.state,
  })
}

// ─────────────────────────────────────────────────────────────
// Teardown
// ─────────────────────────────────────────────────────────────

export function closeSession(sessionId: string, reason: string): void {
  const session = state.sessions.get(sessionId)
  if (!session) return

  broadcastToSession(state, sessionId, 'session:closed', { reason })

  for (const userId of session.users) {
    const ws = state.connections.get(userId)
    if (ws) {
      ws.close(1000, reason)
      state.connections.delete(userId)
    }
    state.sessionMap.delete(userId)
    state.chatCooldowns.delete(userId)
  }

  state.sessions.delete(sessionId)
}

/** Marks a saved session and tells the room. Called after the REST save succeeds. */
export function markSessionSaved(sessionId: string): void {
  const session = state.sessions.get(sessionId)
  if (!session) return

  session.isSaved = true
  broadcastToSession(state, sessionId, 'session:saved', {
    sessionId,
    savedAt: new Date().toISOString(),
  })
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null

/** Starts the housekeeping loop. Idempotent; call once from the WS route. */
export function startCleanupLoop(): void {
  if (cleanupTimer) return

  cleanupTimer = setInterval(() => {
    pruneRateLimits()

    for (const [sessionId, session] of state.sessions) {
      if (session.users.size === 0) {
        state.sessions.delete(sessionId)
        continue
      }

      const ownerOnline = state.connections.has(session.ownerId)
      const tempOnline = session.tempOwnerId ? state.connections.has(session.tempOwnerId) : false

      if (!ownerOnline && !tempOnline) {
        closeSession(sessionId, 'Owner offline and no temp owner')
      }
    }
  }, SESSION_CLEANUP_INTERVAL)

  // Never hold the process open for this.
  cleanupTimer.unref?.()
}

export function stopCleanupLoop(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}
