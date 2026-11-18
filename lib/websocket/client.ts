import { RECONNECT_DELAY } from '@/lib/constants'
import type {
  ClientEventPayloads,
  ClientEventType,
  ServerEventHandler,
  ServerEventType,
} from '@/types/websocket'

type AnyHandler = (payload: never) => void

export interface WebSocketClientOptions {
  url: string
  sessionId: string
  onOpen?: () => void
  onClose?: () => void
  onError?: (message: string) => void
}

export class WebSocketClient {
  private socket: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private handlers = new Map<string, Set<AnyHandler>>()
  private closedByUs = false
  private readonly options: WebSocketClientOptions

  constructor(options: WebSocketClientOptions) {
    this.options = options
  }

  setSessionId(sessionId: string): void {
    this.options.sessionId = sessionId
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  connect(): void {
    this.closedByUs = false

    try {
      this.socket = new WebSocket(this.options.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.socket.onopen = () => {
      this.send('join', { sessionId: this.options.sessionId })
      this.options.onOpen?.()
    }

    this.socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data as string) as {
          type: ServerEventType
          payload: unknown
        }
        this.emit(message.type, message.payload)
      } catch {
        this.options.onError?.('Received malformed message')
      }
    }

    this.socket.onerror = () => {
      this.options.onError?.('WebSocket error')
    }

    this.socket.onclose = () => {
      this.options.onClose?.()
      if (!this.closedByUs) this.scheduleReconnect()
    }
  }

  disconnect(): void {
    this.closedByUs = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.socket?.close()
    this.socket = null
  }

  /** Flat 3s delay, no backoff — see AGENTS.md §8. */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.closedByUs) this.connect()
    }, RECONNECT_DELAY)
  }

  send<T extends ClientEventType>(type: T, payload: ClientEventPayloads[T]): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false

    this.socket.send(JSON.stringify({ type, payload, timestamp: Date.now() }))
    return true
  }

  on<T extends ServerEventType>(type: T, handler: ServerEventHandler<T>): void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler as AnyHandler)
  }

  off<T extends ServerEventType>(type: T, handler: ServerEventHandler<T>): void {
    this.handlers.get(type)?.delete(handler as AnyHandler)
  }

  private emit(type: ServerEventType, payload: unknown): void {
    const listeners = this.handlers.get(type)
    if (!listeners) return

    for (const handler of listeners) {
      ;(handler as (value: unknown) => void)(payload)
    }
  }
}
