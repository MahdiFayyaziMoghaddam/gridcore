'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  getFileContent,
  getSessionSnapshot,
  observeFile,
} from '@/lib/collaboration/yjs'
import { CURSOR_DEBOUNCE_MS, STATUS_DEBOUNCE_MS } from '@/lib/constants'
import { useFileStore } from '@/stores/fileStore'
import { useWebSocket } from './useWebSocket'
import type { ActivityStatus } from '@/lib/constants'

export interface UseCollaborationReturn {
  getContent: (path: string) => string
  getSnapshot: () => Record<string, string>
  sendCursor: (filePath: string, line: number, column: number) => void
  sendStatus: (filePath: string, status: ActivityStatus) => void
}

/**
 * Owns no state. Binds the yjs document to the fileStore mirror and wires
 * presence onto the socket.
 */
export function useCollaboration(): UseCollaborationReturn {
  const { sessionId, send, isConnected } = useWebSocket()
  const updateFileContent = useFileStore(state => state.updateFileContent)
  const loadFromMap = useFileStore(state => state.loadFromMap)

  // fileStore is a mirror of yjs, refreshed from its observers — never from a
  // diff message (AGENTS.md §8).
  useEffect(() => {
    if (!sessionId) return
    return observeFile(sessionId, updateFileContent)
  }, [sessionId, updateFileContent])

  // Hydrate once per session, after the socket has delivered the owner's ZIP.
  const hydrated = useRef<string | null>(null)
  useEffect(() => {
    if (!sessionId || !isConnected || hydrated.current === sessionId) return

    hydrated.current = sessionId
    const snapshot = getSessionSnapshot(sessionId)
    if (Object.keys(snapshot).length > 0) {
      loadFromMap(snapshot)
    }
  }, [sessionId, isConnected, loadFromMap])

  // One pending cursor per file — the newest position wins.
  const cursorTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const timers = cursorTimers.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  const sendCursor = useCallback(
    (filePath: string, line: number, column: number) => {
      const timers = cursorTimers.current
      const existing = timers.get(filePath)
      if (existing) clearTimeout(existing)

      timers.set(
        filePath,
        setTimeout(() => {
          timers.delete(filePath)
          send('cursor', { sessionId, filePath, position: { line, column } })
        }, CURSOR_DEBOUNCE_MS)
      )
    },
    [send, sessionId]
  )

  const sendStatus = useCallback(
    (filePath: string, status: ActivityStatus) => {
      send('status', { sessionId, filePath, status })
    },
    [send, sessionId]
  )

  return {
    getContent: useCallback((path: string) => getFileContent(sessionId, path), [sessionId]),
    getSnapshot: useCallback(() => getSessionSnapshot(sessionId), [sessionId]),
    sendCursor,
    sendStatus,
  }
}