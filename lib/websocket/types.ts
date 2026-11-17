/**
 * Structural type for the socket the server talks to. Keeps the message
 * handlers testable with a plain object while staying compatible with `ws`.
 */
export interface SocketLike {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
}

export const SOCKET_OPEN = 1