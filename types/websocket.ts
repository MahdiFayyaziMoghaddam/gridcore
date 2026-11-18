import type { ActivityStatus } from '@/lib/constants'
import type { SessionRole, SessionState, SessionUser } from './session'

export interface WSCursor {
  line: number
  column: number
}

export interface WSAwarenessState {
  user: { id: string; name: string }
  cursor: (WSCursor & { filePath: string }) | null
  status: ActivityStatus | null
}

// ─────────────────────────────────────────────────────────────
// Client → Server
// ─────────────────────────────────────────────────────────────

export type ClientEventPayloads = {
  join: { sessionId: string }
  leave: { sessionId: string }
  'session:close': { sessionId: string; save?: boolean }
  'session:save': { sessionId: string }
  'session:id-change': { sessionId: string; newSessionId?: string }
  diff: { sessionId: string; filePath: string; diff: unknown }
  cursor: { sessionId: string; filePath: string; position: WSCursor }
  status: { sessionId: string; filePath: string; status: ActivityStatus }
  'file:create': { sessionId: string; path: string; content?: string; type?: 'file' | 'folder' }
  'file:delete': { sessionId: string; path: string }
  'file:rename': { sessionId: string; oldPath: string; newPath: string }
  chat: { sessionId: string; content: string }
  'ownership:grant': { sessionId: string; userId: string }
  'ownership:revoke': { sessionId: string }
  'send:zip': { targetUserId: string; zip: string; state?: string }
}

export type ClientEventType = keyof ClientEventPayloads

// ─────────────────────────────────────────────────────────────
// Server → Client
// ─────────────────────────────────────────────────────────────

export type ServerEventPayloads = {
  'session:state': SessionState & { users: SessionUser[] }
  'session:closed': { reason: string }
  'session:saved': { sessionId: string; savedAt: string }
  'session:id-changed': { oldSessionId: string; newSessionId: string }

  diff: { userId: string; filePath: string; diff: unknown }
  cursor: { userId: string; filePath: string; position: WSCursor }
  status: { userId: string; filePath: string; status: ActivityStatus }

  'file:created': { userId: string; path: string; content?: string; type?: 'file' | 'folder' }
  'file:deleted': { userId: string; path: string }
  'file:renamed': { userId: string; oldPath: string; newPath: string }

  chat: { userId: string; userName?: string; content: string; timestamp: string }

  'ownership:granted': { userId: string; grantedBy: string }
  'ownership:promoted': { sessionId: string; role: SessionRole; message?: string }
  'ownership:revoked': { userId: string; revokedBy: string }
  'ownership:demoted': { sessionId: string; role: SessionRole; message?: string }
  'ownership:transferred': { tempOwnerId: string; reason: string }
  'ownership:reclaimed': { ownerId: string; tempOwnerId: string; reason: string }

  'user:joined': { userId: string; userName?: string; color?: string }
  'user:left': { userId: string }
  'user:status': { userId: string; status: string }
  'user:cursor': { userId: string; cursor: (WSCursor & { filePath: string }) | null }
  'user:file': { userId: string; filePath: string }

  'request:zip': { targetUserId: string }
  'request:save': { sessionId: string; closeAfterSave?: boolean }
  'receive:zip': { zip: string; state?: string }

  error: { error: string; code?: string }
}

export type ServerEventType = keyof ServerEventPayloads

// ─────────────────────────────────────────────────────────────
// Envelopes
// ─────────────────────────────────────────────────────────────

export interface ClientMessage<T extends ClientEventType = ClientEventType> {
  type: T
  payload: ClientEventPayloads[T]
  timestamp?: number
}

export interface ServerMessage<T extends ServerEventType = ServerEventType> {
  type: T
  payload: ServerEventPayloads[T]
  timestamp?: number
}

export type AnyServerMessage = { [K in ServerEventType]: ServerMessage<K> }[ServerEventType]

export type ServerEventHandler<T extends ServerEventType> = (
  payload: ServerEventPayloads[T]
) => void

export const WebSocketErrorCodes = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_FULL: 'SESSION_FULL',
  SESSION_INACTIVE: 'SESSION_INACTIVE',
  ALREADY_IN_SESSION: 'ALREADY_IN_SESSION',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_IN_SESSION: 'NOT_IN_SESSION',
  OWNER_REQUIRED: 'OWNER_REQUIRED',
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
  EMPTY_MESSAGE: 'EMPTY_MESSAGE',
  CHAT_COOLDOWN: 'CHAT_COOLDOWN',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  MULTI_TAB_BLOCKED: 'MULTI_TAB_BLOCKED',
} as const

export type WebSocketErrorCode = (typeof WebSocketErrorCodes)[keyof typeof WebSocketErrorCodes]
