'use client'

import { useCallback } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { useEditorStore } from '@/stores/editorStore'
import { useWebSocket } from './useWebSocket'
import type { ActivityStatus } from '@/lib/constants'
import type { SessionUser } from '@/types/session'

export interface UsePresenceReturn {
  users: SessionUser[]
  userStatuses: ReturnType<typeof useEditorStore.getState>['userStatuses']
  updateStatus: (filePath: string, status: ActivityStatus) => void
}

export function usePresence(): UsePresenceReturn {
  const usersMap = useSessionStore(state => state.users)
  const userStatuses = useEditorStore(state => state.userStatuses)
  const { sessionId, send } = useWebSocket()

  const updateStatus = useCallback(
    (filePath: string, status: ActivityStatus) => {
      send('status', { sessionId, filePath, status })
    },
    [send, sessionId]
  )

  return { users: Array.from(usersMap.values()), userStatuses, updateStatus }
}