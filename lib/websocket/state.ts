import type { SocketLike } from '@/lib/websocket/types'

/** One active session. Lives only in this process; lost on restart. */
export interface ActiveSession {
  id: string
  name: string
  ownerId: string
  tempOwnerId?: string
  users: Set<string>
  isSaved: boolean
  zipUrl?: string
  createdAt: Date
}

export interface ServerState {
  sessions: Map<string, ActiveSession>
  connections: Map<string, SocketLike>
  /** userId -> sessionId. One session per user, enforced. */
  sessionMap: Map<string, string>
  chatCooldowns: Map<string, Date>
}

export const state: ServerState = {
  sessions: new Map(),
  connections: new Map(),
  sessionMap: new Map(),
  chatCooldowns: new Map(),
}

/** Test-only. Clears every map so specs start from a known state. */
export function resetServerState(): void {
  state.sessions.clear()
  state.connections.clear()
  state.sessionMap.clear()
  state.chatCooldowns.clear()
}
