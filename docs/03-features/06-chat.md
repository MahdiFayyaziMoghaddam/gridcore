# GridCore - Real-Time Chat

## 📋 Overview

The chat system in GridCore provides **real-time messaging** within sessions. Messages are **not persisted** in the database and are lost when the session ends. Each message is limited to **200 characters** with a **10-second cooldown** between messages per user. Users can also **mute** chat sounds.

---

## 🏗️ Chat Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Chat Architecture │
├─────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Client │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Chat Store │ │ Chat UI │ │ Sound │ │ │
│ │ │ (Zustand) │──│ (Component) │──│ (Audio) │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ │ │ │ │ │ │
│ │ └─────────────────┼─────────────────┘ │ │
│ │ │ │ │
│ │ ┌──────▼──────┐ │ │
│ │ │ WebSocket │ │ │
│ │ │ (Send) │ │ │
│ │ └─────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ WebSocket Server │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Validate │──│ Cooldown │──│ Broadcast │ │ │
│ │ │ (200 chars) │ │ (10s) │ │ (All users) │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────┘
```

---
```

## 📦 Chat Store (Zustand)

### File: `stores/chatStore.ts`

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// ─────────────────────────────────────────────────────────────
// 1. Types
// ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  userId: string
  userName: string
  content: string
  timestamp: string
}

export interface ChatStore {
  // State
  messages: ChatMessage[]
  isMuted: boolean
  unreadCount: number

  // Actions
  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  toggleMute: () => void
  setMuted: (muted: boolean) => void
  incrementUnread: () => void
  resetUnread: () => void
}

// ─────────────────────────────────────────────────────────────
// 2. Store Implementation
// ─────────────────────────────────────────────────────────────

export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      // ──── Initial State ──────────────────────────────────

      messages: [],
      isMuted: false,
      unreadCount: 0,

      // ──── Actions ──────────────────────────────────────

      addMessage: (message: ChatMessage) => {
        set((state) => ({
          messages: [...state.messages, message],
          unreadCount: state.unreadCount + 1
        }))
      },

      clearMessages: () => {
        set({
          messages: [],
          unreadCount: 0
        })
      },

      toggleMute: () => {
        set((state) => ({
          isMuted: !state.isMuted
        }))
      },

      setMuted: (muted: boolean) => {
        set({ isMuted: muted })
      },

      incrementUnread: () => {
        set((state) => ({
          unreadCount: state.unreadCount + 1
        }))
      },

      resetUnread: () => {
        set({ unreadCount: 0 })
      }
    }),
    { name: 'chat-store' }
  )
)
🎙️ Chat Hook
File: hooks/useChat.ts
typescript
import { useState, useCallback, useRef, useEffect } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useWebSocket } from './useWebSocket'
import { useUser } from './useUser'

interface UseChatOptions {
  sessionId: string
}

export function useChat({ sessionId }: UseChatOptions) {
  const { messages, isMuted, unreadCount, addMessage, clearMessages, toggleMute, resetUnread } = useChatStore()
  const { userId, userName } = useUser()
  const { send, isConnected, onEvent } = useWebSocket()

  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messageIdCounter = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ──── Audio ──────────────────────────────────────────────

  useEffect(() => {
    // Load notification sound
    audioRef.current = new Audio('/sounds/chat-notification.mp3')
    audioRef.current.volume = 0.3
  }, [])

  // ──── Receive Messages ──────────────────────────────────

  useEffect(() => {
    // Listen for chat messages from server
    onEvent('chat', (payload: any) => {
      const message: ChatMessage = {
        id: `msg-${Date.now()}-${payload.userId}`,
        userId: payload.userId,
        userName: payload.userName || 'Unknown User',
        content: payload.content,
        timestamp: payload.timestamp || new Date().toISOString()
      }

      addMessage(message)

      // Play sound if not muted and message is from other user
      if (!isMuted && payload.userId !== userId) {
        audioRef.current?.play().catch(() => {
          // Autoplay might be blocked
        })
      }
    })

    // Cleanup
    return () => {
      // Remove event listener
    }
  }, [onEvent, addMessage, isMuted, userId])

  // ──── Send Message ──────────────────────────────────────

  const sendMessage = useCallback(async (content: string) => {
    // Validate
    if (!content.trim()) {
      setError('Message cannot be empty')
      return
    }

    if (content.length > 200) {
      setError('Message exceeds 200 character limit')
      return
    }

    if (!isConnected) {
      setError('Not connected to server')
      return
    }

    setIsSending(true)
    setError(null)

    try {
      // Send via WebSocket
      send('chat', {
        sessionId,
        content: content.trim()
      })

      // Clear error after success
      setTimeout(() => setError(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }, [content, isConnected, send, sessionId])

  // ──── Return ─────────────────────────────────────────────

  return {
    messages,
    isMuted,
    unreadCount,
    isSending,
    error,
    sendMessage,
    clearMessages,
    toggleMute,
    resetUnread,
    hasMessages: messages.length > 0
  }
}
💬 Chat UI Component
File: components/chat/ChatPanel.tsx
typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Volume2, VolumeX, MessageCircle, X } from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface ChatPanelProps {
  sessionId: string
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const { messages, isMuted, unreadCount, sendMessage, toggleMute, resetUnread } = useChat({ sessionId })
  const { userId, userName } = useUser()
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ──── Auto-scroll to bottom ─────────────────────────────

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // ──── Reset unread when focused ─────────────────────────

  useEffect(() => {
    if (isFocused) {
      resetUnread()
    }
  }, [isFocused, resetUnread])

  // ──── Message handlers ──────────────────────────────────

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input.trim())
      setInput('')
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ──── Format timestamp ──────────────────────────────────

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // ──── Get user initials ─────────────────────────────────

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // ──── Render ─────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-muted-foreground" />
          <span className="font-semibold text-sm">Chat</span>
          {unreadCount > 0 && !isFocused && (
            <span className="flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium text-white bg-primary rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleMute}
            className="h-7 w-7 p-0"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <MessageCircle size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.userId === userId

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex items-start gap-2 animate-in slide-in-from-bottom-2 duration-200',
                    isOwn ? 'flex-row-reverse' : ''
                  )}
                >
                  <Avatar className="h-7 w-7 mt-0.5">
                    <AvatarFallback className="text-xs">
                      {getInitials(message.userName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className={cn(
                    'flex flex-col max-w-[80%]',
                    isOwn ? 'items-end' : ''
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {isOwn ? 'You' : message.userName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    <div className={cn(
                      'px-3 py-1.5 rounded-lg text-sm break-words',
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface border border-border'
                    )}>
                      {message.content}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-2 border-t border-border">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 200))}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Type a message (200 char max)..."
            className="flex-1 text-sm"
            maxLength={200}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || !isFocused}
            className="h-9 w-9 p-0"
          >
            <Send size={16} />
          </Button>
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>{input.length}/200 characters</span>
          <span>10s cooldown between messages</span>
        </div>
      </div>
    </div>
  )
}
🔌 Server-Side Chat Handling
File: app/api/websocket/route.ts (Chat Handlers)
typescript
// ─────────────────────────────────────────────────────────────
// Chat Constants
// ─────────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 200
const CHAT_COOLDOWN_MS = 10 * 1000 // 10 seconds
const MAX_MESSAGES_IN_MEMORY = 100

// In-memory chat history per session
const chatHistory = new Map<string, ChatMessage[]>()

// ─────────────────────────────────────────────────────────────
// Chat Message Type
// ─────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  userId: string
  userName: string
  content: string
  timestamp: string
}

// ─────────────────────────────────────────────────────────────
// Chat Handler
// ─────────────────────────────────────────────────────────────

async function handleChat(payload: { sessionId: string; content: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) {
    sendError(state.connections.get(userId), 'Session not found')
    return
  }

  // Check if user is in session
  if (!session.users.has(userId)) {
    sendError(state.connections.get(userId), 'User not in session')
    return
  }

  // Validate message length
  if (payload.content.length > MAX_MESSAGE_LENGTH) {
    sendError(state.connections.get(userId), 'Message exceeds 200 characters')
    return
  }

  if (payload.content.trim().length === 0) {
    sendError(state.connections.get(userId), 'Message cannot be empty')
    return
  }

  // Check cooldown
  const lastMessageTime = state.chatCooldowns.get(userId)
  if (lastMessageTime && Date.now() - lastMessageTime.getTime() < CHAT_COOLDOWN_MS) {
    const remaining = Math.ceil((CHAT_COOLDOWN_MS - (Date.now() - lastMessageTime.getTime())) / 1000)
    sendError(state.connections.get(userId), `Please wait ${remaining} seconds before sending another message`)
    return
  }

  // Update cooldown
  state.chatCooldowns.set(userId, new Date())

  // Get user name
  const user = await db.select().from(users).where(eq(users.id, userId)).get()
  const userName = user?.name || 'Unknown User'

  // Create message
  const message: ChatMessage = {
    id: `msg-${Date.now()}-${userId}`,
    userId,
    userName,
    content: payload.content.trim(),
    timestamp: new Date().toISOString()
  }

  // Store in memory (limited to MAX_MESSAGES_IN_MEMORY)
  if (!chatHistory.has(payload.sessionId)) {
    chatHistory.set(payload.sessionId, [])
  }

  const history = chatHistory.get(payload.sessionId)!
  history.push(message)

  if (history.length > MAX_MESSAGES_IN_MEMORY) {
    history.shift() // Remove oldest
  }

  // Broadcast to all users in session
  broadcastToSession(payload.sessionId, {
    type: 'chat',
    payload: message
  })
}

// ─────────────────────────────────────────────────────────────
// Get Chat History (for new users)
// ─────────────────────────────────────────────────────────────

function getChatHistory(sessionId: string): ChatMessage[] {
  return chatHistory.get(sessionId) || []
}

// ─────────────────────────────────────────────────────────────
// Clear Chat History (on session close)
// ─────────────────────────────────────────────────────────────

function clearChatHistory(sessionId: string): void {
  chatHistory.delete(sessionId)
}
🔔 Notification System
File: components/chat/NotificationToast.tsx
typescript
'use client'

import { useEffect } from 'react'
import { toast } from 'react-toastify'
import { useChatStore } from '@/stores/chatStore'
import { useUser } from '@/hooks/useUser'

export function NotificationToast() {
  const { messages, isMuted } = useChatStore()
  const { userId } = useUser()

  useEffect(() => {
    if (messages.length === 0) return

    const lastMessage = messages[messages.length - 1]

    // Don't show notification for own messages
    if (lastMessage.userId === userId) return

    // Don't show if muted
    if (isMuted) return

    // Show toast notification
    toast.info(
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="font-semibold text-sm">{lastMessage.userName}</p>
          <p className="text-sm truncate">{lastMessage.content}</p>
        </div>
      </div>,
      {
        position: 'bottom-right',
        autoClose: 5000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: 'bg-surface border border-border shadow-lg'
      }
    )
  }, [messages, userId, isMuted])

  return null
}
🔇 Sound System
File: lib/sound/index.ts
typescript
export class SoundManager {
  private static instance: SoundManager
  private sounds: Map<string, HTMLAudioElement> = new Map()

  private constructor() {
    // Preload sounds
    this.loadSound('chat', '/sounds/chat-notification.mp3')
    this.loadSound('join', '/sounds/user-joined.mp3')
    this.loadSound('leave', '/sounds/user-left.mp3')
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager()
    }
    return SoundManager.instance
  }

  private loadSound(name: string, path: string): void {
    try {
      const audio = new Audio(path)
      audio.volume = 0.3
      this.sounds.set(name, audio)
    } catch (error) {
      console.warn(`Failed to load sound: ${name}`, error)
    }
  }

  play(soundName: string, muted: boolean = false): void {
    if (muted) return

    const sound = this.sounds.get(soundName)
    if (sound) {
      // Reset and play
      sound.currentTime = 0
      sound.play().catch(() => {
        // Autoplay might be blocked
      })
    }
  }
}

export const soundManager = SoundManager.getInstance()
📊 Chat Metrics
File: lib/chat/metrics.ts
typescript
import { state } from '@/lib/websocket/state'
import { chatHistory } from '@/app/api/websocket/route'

export function getChatMetrics() {
  let totalMessages = 0
  let activeChats = 0

  for (const [, messages] of chatHistory) {
    totalMessages += messages.length
    activeChats++
  }

  return {
    totalMessages,
    activeChats,
    messagesPerSession: activeChats > 0 ? totalMessages / activeChats : 0,
    sessionCount: state.sessions.size
  }
}

export function getSessionChatMetrics(sessionId: string) {
  const messages = chatHistory.get(sessionId) || []
  const users = new Set(messages.map(m => m.userId))

  return {
    messageCount: messages.length,
    userCount: users.size,
    latestMessage: messages.length > 0 ? messages[messages.length - 1] : null
  }
}
🧪 Testing
File: __tests__/chat.test.ts
typescript
import { describe, it, expect } from '@jest/globals'
import { useChatStore } from '@/stores/chatStore'

describe('Chat', () => {
  it('should add messages', () => {
    const { addMessage, messages } = useChatStore.getState()

    const message = {
      id: 'test-1',
      userId: 'user-1',
      userName: 'John',
      content: 'Hello',
      timestamp: new Date().toISOString()
    }

    addMessage(message)

    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe('Hello')
  })

  it('should toggle mute', () => {
    const { toggleMute, isMuted } = useChatStore.getState()

    expect(isMuted).toBe(false)

    toggleMute()
    expect(useChatStore.getState().isMuted).toBe(true)
  })

  it('should clear messages', () => {
    const { addMessage, clearMessages, messages } = useChatStore.getState()

    addMessage({
      id: 'test-1',
      userId: 'user-1',
      userName: 'John',
      content: 'Hello',
      timestamp: new Date().toISOString()
    })

    clearMessages()

    expect(messages.length).toBe(0)
  })
})
📝 Error Messages
typescript
// lib/chat/errors.ts

export const ChatErrorCodes = {
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
  EMPTY_MESSAGE: 'EMPTY_MESSAGE',
  COOLDOWN: 'COOLDOWN',
  NOT_IN_SESSION: 'NOT_IN_SESSION',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND'
}

export function getChatErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    [ChatErrorCodes.MESSAGE_TOO_LONG]: 'Message exceeds 200 character limit',
    [ChatErrorCodes.EMPTY_MESSAGE]: 'Message cannot be empty',
    [ChatErrorCodes.COOLDOWN]: 'Please wait before sending another message',
    [ChatErrorCodes.NOT_IN_SESSION]: 'You must be in a session to chat',
    [ChatErrorCodes.SESSION_NOT_FOUND]: 'Session not found'
  }

  return messages[code] || 'An error occurred'
}
Next: Read 07-user-presence.md for user presence implementation.

```
