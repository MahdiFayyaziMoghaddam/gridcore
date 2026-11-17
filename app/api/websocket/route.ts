import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/nextauth'
import {
  handleConnect,
  handleDisconnect,
  handleMessage,
  startCleanupLoop,
} from '@/lib/websocket/server'
import type { SocketLike } from '@/lib/websocket/types'

export const dynamic = 'force-dynamic'

interface UpgradableRequest extends Request {
  upgrade?: () => { socket: unknown; response: Response }
}

/**
 * WebSocket upgrade endpoint. The upgrade itself is platform-provided
 * (Vercel injects `request.upgrade`); everything after the handshake lives in
 * lib/websocket/server.ts so it can be tested without a socket.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const upgrade = (request as UpgradableRequest).upgrade

  if (typeof upgrade !== 'function') {
    return new Response('WebSocket upgrade is not supported by this runtime', {
      status: 501,
    })
  }

  const { socket, response } = upgrade.call(request)

  // The platform socket is a real stream, not a `ws` instance. Wrap it in a
  // minimal event source that satisfies SocketLike plus the handlers we need.
  const raw = socket as {
    addEventListener?: (type: string, listener: (event: unknown) => void) => void
    send?: (data: string) => void
    close?: (code?: number, reason?: string) => void
    on?: (type: string, listener: (payload: unknown) => void) => void
    readyState?: number
  }

  let open = false
  const wrapper: SocketLike = {
    get readyState() {
      return open ? 1 : 0
    },
    send(data: string) {
      raw.send?.(data)
    },
    close(code?: number, reason?: string) {
      raw.close?.(code, reason)
    },
  }

  const onMessage = (data: unknown): void => {
    let parsed: unknown
    try {
      parsed = JSON.parse(typeof data === 'string' ? data : String(data))
    } catch {
      return
    }
    void handleMessage(parsed, session.user.id)
  }

  const onClose = (): void => {
    open = false
    handleDisconnect(session.user.id)
  }

  if (raw.on) {
    raw.on('open', () => {
      open = true
      handleConnect(session.user.id, wrapper)
      startCleanupLoop()
    })
    raw.on('message', onMessage)
    raw.on('close', onClose)
    raw.on('error', onClose)
  } else if (raw.addEventListener) {
    raw.addEventListener('open', () => {
      open = true
      handleConnect(session.user.id, wrapper)
      startCleanupLoop()
    })
    raw.addEventListener('message', onMessage)
    raw.addEventListener('close', onClose)
    raw.addEventListener('error', onClose)
  }

  return response as Response
}