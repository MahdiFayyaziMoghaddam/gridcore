import { WebSocketErrorCodes } from '@/types/websocket'
import { SOCKET_OPEN, type SocketLike } from '@/lib/websocket/types'

export function sendError(ws: SocketLike | undefined, error: string, code?: string): void {
  if (!ws || ws.readyState !== SOCKET_OPEN) return
  ws.send(JSON.stringify({ type: 'error', payload: { error, code } }))
}

export function sendToUser(
  connections: Map<string, SocketLike>,
  userId: string,
  type: string,
  payload: unknown
): void {
  const ws = connections.get(userId)
  if (!ws || ws.readyState !== SOCKET_OPEN) return
  ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }))
}

/**
 * `exclude` matters: diff/cursor/status must not echo back to the sender
 * (they already applied the change locally), while file/session events must.
 */
export function broadcastToSession(
  state: {
    sessions: Map<string, { users: Set<string> }>
    connections: Map<string, SocketLike>
  },
  sessionId: string,
  type: string,
  payload: unknown,
  exclude: string[] = []
): void {
  const session = state.sessions.get(sessionId)
  if (!session) return

  const message = JSON.stringify({ type, payload, timestamp: Date.now() })

  for (const userId of session.users) {
    if (exclude.includes(userId)) continue
    const ws = state.connections.get(userId)
    if (ws && ws.readyState === SOCKET_OPEN) {
      ws.send(message)
    }
  }
}

export { WebSocketErrorCodes }