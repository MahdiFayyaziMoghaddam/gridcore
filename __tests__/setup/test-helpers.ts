import { nextAuthJwt } from './jwt'

import { handleDisconnect, handleMessage } from '@/lib/websocket/server'
import { resetServerState, state, type ActiveSession } from '@/lib/websocket/state'
import { SOCKET_OPEN, type SocketLike } from '@/lib/websocket/types'

export const OWNER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
export const TEMP = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
export const GUEST = 'cccccccc-3333-4333-8333-cccccccccccc'
export const SESSION = 'dddddddd-4444-4444-8444-dddddddddddd'

export interface TestSocket extends SocketLike {
  sent: string[]
  closeCalls: { code?: number; reason?: string }[]
}

/** A socket that records everything written to it, so specs can assert on it. */
export function makeSocket(): TestSocket {
  const sent: string[] = []
  const closeCalls: { code?: number; reason?: string }[] = []

  return {
    sent,
    closeCalls,
    readyState: SOCKET_OPEN,
    send(data: string) {
      sent.push(data)
    },
    close(code?: number, reason?: string) {
      closeCalls.push({ code, reason })
    },
  }
}

export function seedSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  const session: ActiveSession = {
    id: SESSION,
    name: 'Integration Session',
    ownerId: OWNER,
    users: new Set([OWNER]),
    isSaved: false,
    createdAt: new Date(),
    ...overrides,
  }

  state.sessions.set(session.id, session)
  return session
}

export function connectUser(userId: string, sessionId?: string): TestSocket {
  const socket = makeSocket()
  state.connections.set(userId, socket)
  if (sessionId) state.sessionMap.set(userId, sessionId)
  return socket
}

export function eventsOf(socket: TestSocket): { type: string; payload: unknown }[] {
  return socket.sent.map(raw => JSON.parse(raw) as { type: string; payload: unknown })
}

export function typesOf(socket: TestSocket): string[] {
  return eventsOf(socket).map(event => event.type)
}

export { handleDisconnect, handleMessage, nextAuthJwt, resetServerState, state }