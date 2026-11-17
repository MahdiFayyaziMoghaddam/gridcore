import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { MAX_CHAT_HISTORY } from '@/lib/constants'

export interface ChatMessage {
  id: string
  userId: string
  userName?: string
  content: string
  timestamp: string
  isOwn?: boolean
}

interface ChatStore {
  messages: ChatMessage[]
  isMuted: boolean
  unreadCount: number

  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  toggleMute: () => void
  setMuted: (isMuted: boolean) => void
  resetUnread: () => void
}

export const useChatStore = create<ChatStore>()(
  devtools(
    set => ({
      messages: [],
      isMuted: false,
      unreadCount: 0,

      addMessage: message =>
        set(prev => {
          const messages = [...prev.messages, message]
          return {
            // In-memory only, capped — chat is never persisted.
            messages: messages.slice(-MAX_CHAT_HISTORY),
            unreadCount: message.isOwn ? prev.unreadCount : prev.unreadCount + 1,
          }
        }),

      clearMessages: () => set({ messages: [], unreadCount: 0 }),

      toggleMute: () => set(prev => ({ isMuted: !prev.isMuted })),

      setMuted: isMuted => set({ isMuted }),

      resetUnread: () => set({ unreadCount: 0 }),
    }),
    { name: 'chat-store' }
  )
)