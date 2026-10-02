# GridCore - User Presence

## 📋 Overview

User presence in GridCore tracks who is online, what they're doing, and where they are in the session. This includes **cursor positions**, **file status**, **user avatars**, and **real-time updates** via WebSocket. Each user is assigned a **random color** for visual identification.

---

## 🏗️ Presence Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User Presence Architecture │
├─────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Client │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ User Store │ │ Editor │ │ UI │ │ │
│ │ │ (Zustand) │──│ (Cursor) │──│ (Avatars) │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ │ │ │ │ │ │
│ │ └─────────────────┼─────────────────┘ │ │
│ │ │ │ │
│ │ ┌──────▼──────┐ │ │
│ │ │ yjs │ │ │
│ │ │ Awareness │ │ │
│ │ └─────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ WebSocket Server │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Cursor │ │ Status │ │ User List │ │ │
│ │ │ Handler │──│ Handler │──│ (Broadcast) │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────┘
```

---
```

## 👤 User Types

### File: `types/user.ts`

```typescript
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  color: string
  status: UserStatus
  currentFile?: string
  cursor?: CursorPosition
  isOnline: boolean
}

export interface UserStatus {
  status: 'online' | 'idle' | 'editing' | 'away'
  filePath?: string
  lastActive: Date
}

export interface CursorPosition {
  filePath: string
  line: number
  column: number
  selection?: {
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
  }
}

export interface UserPresence {
  userId: string
  userName: string
  color: string
  cursor?: CursorPosition
  status: UserStatus
  currentFile?: string
}
🎨 User Color Generation
File: lib/colors.ts
typescript
// ─────────────────────────────────────────────────────────────
// 1. Color Generation
// ─────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#FF8A5C', // Orange
  '#A29BFE', // Purple
  '#FD79A8', // Pink
  '#00CEC9', // Cyan
  '#FDCB6E', // Gold
  '#6C5CE7', // Violet
  '#00B894', // Mint
  '#E17055', // Coral
  '#0984E3', // Royal Blue
  '#F368E0', // Magenta
]

let colorIndex = 0

export function generateUserColor(): string {
  const color = PRESET_COLORS[colorIndex % PRESET_COLORS.length]
  colorIndex++
  return color
}

export function getUserColor(userId: string): string {
  // Deterministic color based on user ID
  const hash = userId.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)

  const index = Math.abs(hash) % PRESET_COLORS.length
  return PRESET_COLORS[index]
}

// ─────────────────────────────────────────────────────────────
// 2. Color Utilities
// ─────────────────────────────────────────────────────────────

export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

export function darkenColor(hexColor: string, amount: number): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const newR = Math.max(0, r - amount)
  const newG = Math.max(0, g - amount)
  const newB = Math.max(0, b - amount)

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
}

export function lightenColor(hexColor: string, amount: number): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const newR = Math.min(255, r + amount)
  const newG = Math.min(255, g + amount)
  const newB = Math.min(255, b + amount)

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
}
📦 User Store (Zustand)
File: stores/userStore.ts
typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { getUserColor } from '@/lib/colors'

// ─────────────────────────────────────────────────────────────
// 1. Types
// ─────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  color: string
  isOnline: boolean
  currentFile?: string
  cursor?: {
    filePath: string
    line: number
    column: number
  }
  status: 'online' | 'idle' | 'editing' | 'away'
  lastActive: Date
}

export interface UserStore {
  // State
  currentUser: User | null
  users: Map<string, User>
  onlineCount: number

  // Actions
  setCurrentUser: (user: User) => void
  addUser: (user: User) => void
  removeUser: (userId: string) => void
  updateUserStatus: (userId: string, status: User['status']) => void
  updateUserCursor: (userId: string, cursor: User['cursor']) => void
  updateUserFile: (userId: string, filePath: string) => void
  setOnlineCount: (count: number) => void
  clearUsers: () => void
  getUser: (userId: string) => User | undefined
  getCurrentUsers: () => User[]
}

// ─────────────────────────────────────────────────────────────
// 2. Store Implementation
// ─────────────────────────────────────────────────────────────

export const useUserStore = create<UserStore>()(
  devtools(
    (set, get) => ({
      // ──── Initial State ──────────────────────────────────

      currentUser: null,
      users: new Map(),
      onlineCount: 0,

      // ──── Actions ──────────────────────────────────────

      setCurrentUser: (user: User) => {
        set((state) => {
          const newUsers = new Map(state.users)
          newUsers.set(user.id, user)
          return {
            currentUser: user,
            users: newUsers,
            onlineCount: newUsers.size
          }
        })
      },

      addUser: (user: User) => {
        set((state) => {
          const newUsers = new Map(state.users)

          // Check if user already exists
          if (newUsers.has(user.id)) {
            const existing = newUsers.get(user.id)!
            newUsers.set(user.id, {
              ...existing,
              ...user,
              isOnline: true
            })
          } else {
            newUsers.set(user.id, {
              ...user,
              color: user.color || getUserColor(user.id),
              isOnline: true,
              status: 'online',
              lastActive: new Date()
            })
          }

          return {
            users: newUsers,
            onlineCount: newUsers.size
          }
        })
      },

      removeUser: (userId: string) => {
        set((state) => {
          const newUsers = new Map(state.users)
          newUsers.delete(userId)
          return {
            users: newUsers,
            onlineCount: newUsers.size
          }
        })
      },

      updateUserStatus: (userId: string, status: User['status']) => {
        set((state) => {
          const newUsers = new Map(state.users)
          const user = newUsers.get(userId)
          if (user) {
            newUsers.set(userId, {
              ...user,
              status,
              lastActive: new Date()
            })
          }
          return { users: newUsers }
        })
      },

      updateUserCursor: (userId: string, cursor: User['cursor']) => {
        set((state) => {
          const newUsers = new Map(state.users)
          const user = newUsers.get(userId)
          if (user) {
            newUsers.set(userId, {
              ...user,
              cursor,
              lastActive: new Date()
            })
          }
          return { users: newUsers }
        })
      },

      updateUserFile: (userId: string, filePath: string) => {
        set((state) => {
          const newUsers = new Map(state.users)
          const user = newUsers.get(userId)
          if (user) {
            newUsers.set(userId, {
              ...user,
              currentFile: filePath,
              status: 'editing',
              lastActive: new Date()
            })
          }
          return { users: newUsers }
        })
      },

      setOnlineCount: (count: number) => {
        set({ onlineCount: count })
      },

      clearUsers: () => {
        set({
          users: new Map(),
          onlineCount: 0
        })
      },

      getUser: (userId: string) => {
        return get().users.get(userId)
      },

      getCurrentUsers: () => {
        return Array.from(get().users.values()).filter(u => u.isOnline)
      }
    }),
    { name: 'user-store' }
  )
)
📍 Cursor Tracking
File: components/editor/CursorOverlay.tsx
typescript
'use client'

import { useEffect, useRef } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useUserStore } from '@/stores/userStore'

interface CursorOverlayProps {
  editorRef: React.RefObject<any>
}

export function CursorOverlay({ editorRef }: CursorOverlayProps) {
  const { users } = useUserStore()
  const { decorations, setDecorations } = useEditorStore()

  useEffect(() => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const newDecorations: any[] = []

    // Get current user's ID (exclude self)
    const currentUserId = useUserStore.getState().currentUser?.id

    // Create decorations for each user's cursor
    for (const [userId, user] of users) {
      if (userId === currentUserId || !user.isOnline) continue
      if (!user.cursor) continue

      const { filePath, line, column } = user.cursor
      const currentFile = useFileStore.getState().activeFile

      // Only show cursor if user is on the same file
      if (filePath !== currentFile) continue

      // Create cursor decoration
      newDecorations.push({
        range: {
          startLineNumber: line,
          startColumn: column,
          endLineNumber: line,
          endColumn: column + 1
        },
        options: {
          className: `cursor-decoration-${userId}`,
          showIfCollapsed: true,
          hoverMessage: { value: user.name },
          beforeContentClassName: `cursor-before-${userId}`
        }
      })

      // Create selection decoration if present
      if (user.cursor.selection) {
        const { startLine, startColumn, endLine, endColumn } = user.cursor.selection
        newDecorations.push({
          range: {
            startLineNumber: startLine,
            startColumn: startColumn,
            endLineNumber: endLine,
            endColumn: endColumn
          },
          options: {
            className: `selection-decoration-${userId}`,
            hoverMessage: { value: `${user.name}'s selection` }
          }
        })
      }
    }

    // Apply decorations to editor
    const decorationIds = editor.deltaDecorations(decorations, newDecorations)
    setDecorations(decorationIds)

    // Cleanup
    return () => {
      editor.deltaDecorations(decorationIds, [])
    }
  }, [users, editorRef, decorations, setDecorations])

  // Add CSS for cursor decorations
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .cursor-decoration-\\w+ {
        background-color: rgba(88, 166, 255, 0.2);
        border-left: 2px solid rgba(88, 166, 255, 0.8);
      }
      .cursor-before-\\w+ {
        content: '';
        position: absolute;
        width: 2px;
        height: 1.2em;
        background-color: rgba(88, 166, 255, 0.8);
        animation: blink 1s step-end infinite;
      }
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return null
}
👤 User List Component
File: components/collaboration/UserList.tsx
typescript
'use client'

import { useUserStore } from '@/stores/userStore'
import { useSession } from '@/hooks/useSession'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Users, Circle, File } from 'lucide-react'

interface UserListProps {
  sessionId: string
}

export function UserList({ sessionId }: UserListProps) {
  const { users, onlineCount } = useUserStore()
  const { isOwner, isTempOwner } = useSession()

  // Get current users (online)
  const onlineUsers = Array.from(users.values()).filter(u => u.isOnline)

  // Get initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Get status indicator color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'editing': return 'bg-blue-500'
      case 'idle': return 'bg-yellow-500'
      case 'away': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  // Get role badge
  const getRoleBadge = (userId: string) => {
    if (isOwner(userId)) {
      return <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Owner</span>
    }
    if (isTempOwner(userId)) {
      return <span className="text-xs bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">Temp</span>
    }
    return null
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <Users size={16} className="text-muted-foreground" />
        <span className="font-semibold text-sm">Users</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {onlineCount} online
        </span>
      </div>

      {/* User List */}
      <ScrollArea className="flex-1 p-2">
        {onlineUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Users size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No users online</p>
          </div>
        ) : (
          <div className="space-y-1">
            {onlineUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 p-2 rounded hover:bg-surface-hover transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-8 w-8" style={{ backgroundColor: user.color }}>
                    <AvatarFallback className="text-xs">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <Circle
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-background stroke-background',
                      getStatusColor(user.status)
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">
                      {user.name}
                    </span>
                    {getRoleBadge(user.id)}
                  </div>

                  {user.currentFile && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <File size={12} />
                      <span>{user.currentFile}</span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground capitalize">
                  {user.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
🔌 Presence Hook
File: hooks/usePresence.ts
typescript
import { useEffect, useCallback } from 'react'
import { useUserStore } from '@/stores/userStore'
import { useWebSocket } from './useWebSocket'
import { getUserColor } from '@/lib/colors'

interface UsePresenceOptions {
  sessionId: string
  userId: string
  userName: string
}

export function usePresence({ sessionId, userId, userName }: UsePresenceOptions) {
  const {
    currentUser,
    users,
    onlineCount,
    addUser,
    removeUser,
    updateUserStatus,
    updateUserCursor,
    updateUserFile,
    setCurrentUser
  } = useUserStore()

  const { send, isConnected, onEvent } = useWebSocket()

  // ──── Initialize Presence ──────────────────────────────

  useEffect(() => {
    if (!isConnected) return

    // Set current user
    const color = getUserColor(userId)
    setCurrentUser({
      id: userId,
      name: userName,
      email: '',
      color,
      isOnline: true,
      status: 'online',
      lastActive: new Date()
    })

    // Listen for presence events
    onEvent('user:joined', (payload: { userId: string; userName: string; color: string }) => {
      addUser({
        id: payload.userId,
        name: payload.userName,
        email: '',
        color: payload.color || getUserColor(payload.userId),
        isOnline: true,
        status: 'online',
        lastActive: new Date()
      })
    })

    onEvent('user:left', (payload: { userId: string }) => {
      removeUser(payload.userId)
    })

    onEvent('user:status', (payload: { userId: string; status: User['status'] }) => {
      updateUserStatus(payload.userId, payload.status)
    })

    onEvent('user:cursor', (payload: { userId: string; cursor: User['cursor'] }) => {
      updateUserCursor(payload.userId, payload.cursor)
    })

    onEvent('user:file', (payload: { userId: string; filePath: string }) => {
      updateUserFile(payload.userId, payload.filePath)
    })

    // Announce presence to server
    send('presence:join', {
      sessionId,
      userId,
      userName,
      color
    })

    // Cleanup
    return () => {
      send('presence:leave', { sessionId })
    }
  }, [sessionId, userId, userName, isConnected])

  // ──── Update Methods ────────────────────────────────────

  const updateStatus = useCallback((status: User['status']) => {
    updateUserStatus(userId, status)
    send('presence:status', {
      sessionId,
      userId,
      status
    })
  }, [userId, sessionId, send, updateUserStatus])

  const updateCursor = useCallback((cursor: User['cursor']) => {
    updateUserCursor(userId, cursor)
    send('presence:cursor', {
      sessionId,
      userId,
      cursor
    })
  }, [userId, sessionId, send, updateUserCursor])

  const updateCurrentFile = useCallback((filePath: string) => {
    updateUserFile(userId, filePath)
    send('presence:file', {
      sessionId,
      userId,
      filePath
    })
  }, [userId, sessionId, send, updateUserFile])

  return {
    currentUser,
    users,
    onlineCount,
    updateStatus,
    updateCursor,
    updateCurrentFile
  }
}
🔌 Server-Side Presence Handlers
File: app/api/websocket/route.ts (Presence Handlers)
typescript
// ─────────────────────────────────────────────────────────────
// Presence State
// ─────────────────────────────────────────────────────────────

interface PresenceState {
  userId: string
  userName: string
  color: string
  status: 'online' | 'idle' | 'editing' | 'away'
  cursor?: {
    filePath: string
    line: number
    column: number
  }
  currentFile?: string
  lastActive: Date
}

const presenceState = new Map<string, Map<string, PresenceState>>() // sessionId → Map<userId, PresenceState>

// ─────────────────────────────────────────────────────────────
// Presence Handlers
// ─────────────────────────────────────────────────────────────

function getPresenceState(sessionId: string): Map<string, PresenceState> {
  if (!presenceState.has(sessionId)) {
    presenceState.set(sessionId, new Map())
  }
  return presenceState.get(sessionId)!
}

function updatePresence(sessionId: string, userId: string, state: Partial<PresenceState>) {
  const sessionPresence = getPresenceState(sessionId)
  const current = sessionPresence.get(userId) || {
    userId,
    userName: '',
    color: '',
    status: 'online',
    lastActive: new Date()
  }

  sessionPresence.set(userId, {
    ...current,
    ...state,
    lastActive: new Date()
  })
}

function broadcastPresence(sessionId: string, type: string, payload: any) {
  broadcastToSession(sessionId, {
    type,
    payload
  })
}

// ─────────────────────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────────────────────

async function handlePresenceJoin(payload: any, userId: string) {
  const { sessionId, userName, color } = payload
  const session = state.sessions.get(sessionId)
  if (!session) return

  // Update presence state
  updatePresence(sessionId, userId, {
    userName,
    color,
    status: 'online'
  })

  // Broadcast to all users
  broadcastPresence(sessionId, 'user:joined', {
    userId,
    userName,
    color
  })

  // Send current presence state to new user
  const sessionPresence = getPresenceState(sessionId)
  const presenceData = Array.from(sessionPresence.values())
    .filter(p => p.userId !== userId)

  for (const data of presenceData) {
    // Send each user's presence
    const ws = state.connections.get(userId)
    if (ws) {
      ws.send(JSON.stringify({
        type: 'user:joined',
        payload: {
          userId: data.userId,
          userName: data.userName,
          color: data.color
        }
      }))

      // Send cursor if exists
      if (data.cursor) {
        ws.send(JSON.stringify({
          type: 'user:cursor',
          payload: {
            userId: data.userId,
            cursor: data.cursor
          }
        }))
      }

      // Send status if exists
      if (data.status) {
        ws.send(JSON.stringify({
          type: 'user:status',
          payload: {
            userId: data.userId,
            status: data.status
          }
        }))
      }
    }
  }
}

async function handlePresenceLeave(payload: { sessionId: string }, userId: string) {
  const { sessionId } = payload
  const session = state.sessions.get(sessionId)
  if (!session) return

  // Remove presence state
  const sessionPresence = getPresenceState(sessionId)
  sessionPresence.delete(userId)

  // Broadcast to all users
  broadcastPresence(sessionId, 'user:left', { userId })
}

async function handlePresenceStatus(payload: { sessionId: string; status: string }, userId: string) {
  const { sessionId, status } = payload
  const session = state.sessions.get(sessionId)
  if (!session) return

  updatePresence(sessionId, userId, { status: status as any })

  broadcastPresence(sessionId, 'user:status', {
    userId,
    status
  })
}

async function handlePresenceCursor(payload: { sessionId: string; cursor: any }, userId: string) {
  const { sessionId, cursor } = payload
  const session = state.sessions.get(sessionId)
  if (!session) return

  updatePresence(sessionId, userId, { cursor })

  broadcastPresence(sessionId, 'user:cursor', {
    userId,
    cursor
  })
}

async function handlePresenceFile(payload: { sessionId: string; filePath: string }, userId: string) {
  const { sessionId, filePath } = payload
  const session = state.sessions.get(sessionId)
  if (!session) return

  updatePresence(sessionId, userId, { currentFile: filePath })

  broadcastPresence(sessionId, 'user:file', {
    userId,
    filePath
  })
}
🧹 Presence Cleanup
typescript
// Clean up presence state when session closes
function cleanupPresence(sessionId: string): void {
  presenceState.delete(sessionId)
}

// Clean up inactive users (no activity for 5 minutes)
setInterval(() => {
  const now = Date.now()
  const timeout = 5 * 60 * 1000 // 5 minutes

  for (const [sessionId, users] of presenceState) {
    for (const [userId, state] of users) {
      if (now - state.lastActive.getTime() > timeout) {
        // User is inactive
        users.delete(userId)
        broadcastPresence(sessionId, 'user:left', { userId })
      }
    }
  }
}, 60 * 1000) // Check every minute
🧪 Testing
File: __tests__/presence.test.ts
typescript
import { describe, it, expect } from '@jest/globals'
import { getUserColor } from '@/lib/colors'

describe('User Presence', () => {
  it('should generate consistent colors for users', () => {
    const userId1 = 'user-123'
    const userId2 = 'user-456'

    const color1 = getUserColor(userId1)
    const color2 = getUserColor(userId2)

    expect(color1).toBeDefined()
    expect(color2).toBeDefined()
    expect(color1).not.toBe(color2)
  })

  it('should generate same color for same user', () => {
    const userId = 'user-123'
    const color1 = getUserColor(userId)
    const color2 = getUserColor(userId)

    expect(color1).toBe(color2)
  })
})
Next: Read 08-ownership.md for ownership implementation.

```
