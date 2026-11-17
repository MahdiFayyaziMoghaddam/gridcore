'use client'

import { useCallback, useState } from 'react'
import { CHAT_MAX_MESSAGE_LENGTH } from '@/lib/constants'
import { useChatStore } from '@/stores/chatStore'
import { useWebSocket } from './useWebSocket'

export interface UseChatReturn {
  messages: ReturnType<typeof useChatStore.getState>['messages']
  isMuted: boolean
  unreadCount: number
  error: string | null
  sendMessage: (content: string) => void
  toggleMute: () => void
  resetUnread: () => void
}

export function useChat(): UseChatReturn {
  const { sessionId, send } = useWebSocket()
  const messages = useChatStore(state => state.messages)
  const isMuted = useChatStore(state => state.isMuted)
  const unreadCount = useChatStore(state => state.unreadCount)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    (content: string) => {
      setError(null)

      const trimmed = content.trim()

      if (!trimmed) {
        setError('Message cannot be empty')
        return
      }

      if (trimmed.length > CHAT_MAX_MESSAGE_LENGTH) {
        setError(`Message exceeds ${CHAT_MAX_MESSAGE_LENGTH} character limit`)
        return
      }

      send('chat', { sessionId, content: trimmed })
    },
    [send, sessionId]
  )

  return {
    messages,
    isMuted,
    unreadCount,
    error,
    sendMessage,
    toggleMute: useCallback(() => useChatStore.getState().toggleMute(), []),
    resetUnread: useCallback(() => useChatStore.getState().resetUnread(), []),
  }
}