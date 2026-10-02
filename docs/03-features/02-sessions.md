# GridCore - Session Management

## 📋 Overview

Session management is the core of GridCore. Sessions are collaborative coding spaces where users can work together in real-time. This document covers session creation, joining, leaving, saving, and all related operations.

---

## 🏗️ Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Session Lifecycle │
├─────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Create │───▶│ Active │───▶│ Save │───▶│ Saved │ │
│ │ Session │ │ Session │ │ Session │ │ Session │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│ │ │ │ │ │
│ │ │ │ │ │
│ ▼ ▼ ▼ ▼ │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Join │ │ Leave │ │ Close │ │ Delete │ │
│ │ Session │ │ Session │ │ Session │ │ Session │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────┘
```

---
```

## 📊 Session State (In-Memory)

### File: `lib/websocket/state.ts`

```typescript
// ─────────────────────────────────────────────────────────────
// 1. Session Types
// ─────────────────────────────────────────────────────────────

export interface Session {
  id: string
  name: string
  ownerId: string
  tempOwnerId?: string
  users: Set<string>
  isSaved: boolean
  zipUrl?: string
  createdAt: Date
}

export interface UserConnection {
  userId: string
  sessionId: string
  ws: WebSocket
  connectedAt: Date
}

export interface RateLimit {
  count: number
  resetTime: number
}

// ─────────────────────────────────────────────────────────────
// 2. Global State
// ─────────────────────────────────────────────────────────────

export interface ServerState {
  // Active sessions
  sessions: Map<string, Session>

  // User connections
  connections: Map<string, WebSocket>
  sessionMap: Map<string, string> // userId → sessionId

  // Rate limiting
  rateLimits: Map<string, RateLimit>

  // Chat cooldowns
  chatCooldowns: Map<string, Date>

  // Session metadata
  sessionMetadata: Map<string, {
    lastActivity: Date
    messageCount: number
  }>
}

export const state: ServerState = {
  sessions: new Map(),
  connections: new Map(),
  sessionMap: new Map(),
  rateLimits: new Map(),
  chatCooldowns: new Map(),
  sessionMetadata: new Map()
}

// ─────────────────────────────────────────────────────────────
// 3. State Helpers
// ─────────────────────────────────────────────────────────────

export function getSession(sessionId: string): Session | undefined {
  return state.sessions.get(sessionId)
}

export function getSessionByUser(userId: string): Session | undefined {
  const sessionId = state.sessionMap.get(userId)
  if (!sessionId) return undefined
  return state.sessions.get(sessionId)
}

export function getUserSessionId(userId: string): string | undefined {
  return state.sessionMap.get(userId)
}

export function isUserInSession(userId: string, sessionId: string): boolean {
  const session = state.sessions.get(sessionId)
  if (!session) return false
  return session.users.has(userId)
}

export function isOwner(userId: string, sessionId: string): boolean {
  const session = state.sessions.get(sessionId)
  if (!session) return false
  return session.ownerId === userId
}

export function isTempOwner(userId: string, sessionId: string): boolean {
  const session = state.sessions.get(sessionId)
  if (!session) return false
  return session.tempOwnerId === userId
}

export function canCreateFiles(userId: string, sessionId: string): boolean {
  return isOwner(userId, sessionId) || isTempOwner(userId, sessionId)
}

export function getSessionUsers(sessionId: string): string[] {
  const session = state.sessions.get(sessionId)
  if (!session) return []
  return Array.from(session.users)
}
🚀 Session Operations
1. Create Session
typescript
// Client Side
async function createSession(name?: string): Promise<string> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create session')
  }

  const data = await response.json()
  return data.sessionId
}

// Server Side
export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name } = await req.json()

  // Check rate limit
  const userSessionsCount = await getSavedSessionsCount(session.user.id)
  if (userSessionsCount >= 3) {
    return Response.json(
      { error: 'Maximum 3 saved sessions allowed' },
      { status: 403 }
    )
  }

  // Generate session ID
  const sessionId = crypto.randomUUID()
  const sessionName = name || `new-session-${Math.random().toString(36).substring(2, 8)}`

  // Create in-memory session
  state.sessions.set(sessionId, {
    id: sessionId,
    name: sessionName,
    ownerId: session.user.id,
    users: new Set([session.user.id]),
    isSaved: false,
    createdAt: new Date()
  })

  // Add user to session map
  state.sessionMap.set(session.user.id, sessionId)

  // Initialize session metadata
  state.sessionMetadata.set(sessionId, {
    lastActivity: new Date(),
    messageCount: 0
  })

  return Response.json({
    sessionId,
    name: sessionName,
    ownerId: session.user.id
  })
}
2. Join Session
typescript
// Client Side
async function joinSession(sessionId: string): Promise<void> {
  // First, validate session exists via API
  const checkResponse = await fetch(`/api/sessions/check/${sessionId}`)
  if (!checkResponse.ok) {
    throw new Error('Session not found or inactive')
  }

  // Connect WebSocket
  const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}?token=${getToken()}`)

  // Send join message
  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'join',
      payload: { sessionId }
    }))
  }

  // Handle response
  return new Promise((resolve, reject) => {
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)

      if (message.type === 'session:state') {
        // Session joined successfully
        resolve()
      } else if (message.type === 'error') {
        reject(new Error(message.payload.error))
      }
    }
  })
}

// Server Side
async function handleJoin(payload: { sessionId: string }, userId: string, ws: WebSocket) {
  const { sessionId } = payload

  // Check if session exists
  const session = state.sessions.get(sessionId)
  if (!session) {
    sendError(ws, 'Session not found')
    return
  }

  // Check if user is already in session
  if (state.sessionMap.get(userId) === sessionId) {
    return // Already joined
  }

  // Check if user is already in another session
  if (state.sessionMap.has(userId)) {
    sendError(ws, 'User already in a session')
    return
  }

  // Check session capacity
  if (session.users.size >= 20) {
    sendError(ws, 'Session is full (max 20 users)')
    return
  }

  // Check if owner is online (unless temp owner exists)
  const isOwnerOnline = state.connections.has(session.ownerId)
  const isTempOwnerOnline = session.tempOwnerId && state.connections.has(session.tempOwnerId)

  if (!isOwnerOnline && !isTempOwnerOnline) {
    sendError(ws, 'Session is not active')
    return
  }

  // Add user to session
  session.users.add(userId)
  state.sessionMap.set(userId, sessionId)

  // Request codebase from provider
  const providerId = isOwnerOnline ? session.ownerId : session.tempOwnerId!
  const providerWs = state.connections.get(providerId)

  if (providerWs) {
    providerWs.send(JSON.stringify({
      type: 'request:zip',
      payload: { targetUserId: userId }
    }))
  }

  // Broadcast join notification
  broadcastToSession(sessionId, {
    type: 'user:joined',
    payload: { userId }
  })

  // Send current session state
  ws.send(JSON.stringify({
    type: 'session:state',
    payload: {
      sessionId,
      sessionName: session.name,
      ownerId: session.ownerId,
      tempOwnerId: session.tempOwnerId,
      users: Array.from(session.users),
      isSaved: session.isSaved
    }
  }))
}
3. Leave Session
typescript
// Client Side
function leaveSession() {
  ws.send(JSON.stringify({
    type: 'leave',
    payload: { sessionId: currentSessionId }
  }))
}

// Server Side
async function handleLeave(payload: { sessionId: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  // Remove user from session
  session.users.delete(userId)
  state.sessionMap.delete(userId)

  // If user was temp owner, remove status
  if (session.tempOwnerId === userId) {
    session.tempOwnerId = undefined
  }

  // Broadcast leave notification
  broadcastToSession(payload.sessionId, {
    type: 'user:left',
    payload: { userId }
  })

  // Check if session should close
  const isOwnerLeaving = userId === session.ownerId
  const hasTempOwner = session.tempOwnerId && session.users.has(session.tempOwnerId)
  const hasUsers = session.users.size > 0

  if (isOwnerLeaving) {
    if (hasTempOwner) {
      // Continue with temp owner
      broadcastToSession(payload.sessionId, {
        type: 'ownership:transferred',
        payload: { tempOwnerId: session.tempOwnerId }
      })
    } else if (hasUsers) {
      // No temp owner, close session
      closeSession(payload.sessionId, 'Owner left without temp owner')
    } else {
      // No users left
      closeSession(payload.sessionId, 'Session empty')
    }
  } else if (!hasUsers) {
    // Last user left
    closeSession(payload.sessionId, 'Session empty')
  }
}
4. Save Session
typescript
// Client Side
async function saveSession(): Promise<void> {
  // Create ZIP of all files
  const zipBuffer = await createZipFile(files)

  // Validate size
  if (zipBuffer.length > 50 * 1024 * 1024) {
    throw new Error('Session exceeds 50MB limit')
  }

  // Send to server
  const response = await fetch(`/api/sessions/${sessionId}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      zip: zipBuffer.toString('base64'),
      name: sessionName
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to save session')
  }
}

// Server Side
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { zip, name } = await req.json()
  const zipBuffer = Buffer.from(zip, 'base64')

  // Validate size
  if (zipBuffer.length > 50 * 1024 * 1024) {
    return Response.json({ error: 'File exceeds 50MB limit' }, { status: 413 })
  }

  // Verify ownership
  const activeSession = state.sessions.get(params.id)
  if (!activeSession || activeSession.ownerId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check saved sessions limit
  const savedCount = await getSavedSessionsCount(session.user.id)
  if (savedCount >= 3) {
    return Response.json(
      { error: 'Maximum 3 saved sessions allowed' },
      { status: 403 }
    )
  }

  // Upload to storage
  const blob = await put(
    `/sessions/${params.id}/codebase.zip`,
    zipBuffer,
    {
      contentType: 'application/zip',
      access: 'private'
    }
  )

  // Save to database
  await db.insert(sessions).values({
    id: params.id,
    name: name || activeSession.name,
    ownerId: session.user.id,
    zipUrl: blob.url,
    createdAt: new Date(),
    updatedAt: new Date()
  })

  await db.insert(userSessions).values({
    userId: session.user.id,
    sessionId: params.id,
    savedAt: new Date()
  })

  // Update in-memory state
  activeSession.isSaved = true
  activeSession.zipUrl = blob.url
  activeSession.name = name || activeSession.name

  // Broadcast save notification
  broadcastToSession(params.id, {
    type: 'session:saved',
    payload: {
      sessionId: params.id,
      savedAt: new Date().toISOString()
    }
  })

  return Response.json({ success: true })
}
5. Close Session
typescript
// Client Side
function closeSession(save: boolean = false) {
  // Show warning if unsaved
  if (!isSaved && !save) {
    if (!confirm('Session is unsaved. Close anyway?')) {
      return
    }
  }

  ws.send(JSON.stringify({
    type: 'session:close',
    payload: { sessionId, save }
  }))
}

// Server Side
async function handleSessionClose(payload: { sessionId: string; save: boolean }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  // Verify user is owner or temp owner
  const isOwner = userId === session.ownerId
  const isTempOwner = userId === session.tempOwnerId

  if (!isOwner && !isTempOwner) {
    sendError(state.connections.get(userId), 'Only owners can close the session')
    return
  }

  // If saving requested and user is owner
  if (payload.save && isOwner) {
    // Trigger save flow
    const ownerWs = state.connections.get(session.ownerId)
    if (ownerWs) {
      ownerWs.send(JSON.stringify({
        type: 'request:save',
        payload: { sessionId: payload.sessionId, closeAfterSave: true }
      }))
    }
  } else {
    // Close immediately
    closeSession(payload.sessionId, `Closed by ${userId}`)
  }
}

function closeSession(sessionId: string, reason: string) {
  const session = state.sessions.get(sessionId)
  if (!session) return

  // Notify all users
  broadcastToSession(sessionId, {
    type: 'session:closed',
    payload: { reason }
  })

  // Close all connections
  for (const userId of session.users) {
    const ws = state.connections.get(userId)
    if (ws) {
      ws.close(1000, reason)
      state.connections.delete(userId)
      state.sessionMap.delete(userId)
    }
  }

  // Clean up
  state.sessions.delete(sessionId)
  state.sessionMetadata.delete(sessionId)

  // Clean up chat cooldowns
  for (const userId of session.users) {
    state.chatCooldowns.delete(userId)
  }
}
6. Change Session ID (Owner Only)
typescript
// Client Side
function changeSessionId() {
  const newId = crypto.randomUUID()

  ws.send(JSON.stringify({
    type: 'session:id-change',
    payload: { sessionId, newSessionId: newId }
  }))
}

// Server Side
async function handleSessionIdChange(payload: { sessionId: string; newSessionId: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  // Verify owner
  if (userId !== session.ownerId) {
    sendError(state.connections.get(userId), 'Only owner can change session ID')
    return
  }

  // Generate new ID (or use provided one)
  const newSessionId = payload.newSessionId || crypto.randomUUID()

  // Get session data
  const sessionData = state.sessions.get(payload.sessionId)
  if (!sessionData) return

  // Remove old session
  state.sessions.delete(payload.sessionId)

  // Create new session with new ID
  state.sessions.set(newSessionId, {
    ...sessionData,
    id: newSessionId
  })

  // Update session map for all users
  for (const userId of sessionData.users) {
    state.sessionMap.set(userId, newSessionId)
  }

  // Broadcast new session ID
  broadcastToSession(newSessionId, {
    type: 'session:id-changed',
    payload: {
      oldSessionId: payload.sessionId,
      newSessionId
    }
  })
}
7. Load Saved Session
typescript
// Client Side
async function loadSavedSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions/${sessionId}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to load session')
  }

  const data = await response.json()

  // Extract ZIP from response
  const zipBuffer = Buffer.from(data.zip, 'base64')

  // Load files into editor
  const files = await extractZip(zipBuffer)
  loadFiles(files)

  // Join session
  await joinSession(sessionId)
}

// Server Side
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if session exists in database
  const savedSession = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, params.id))
    .get()

  if (!savedSession) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  // Verify user has access
  const userAccess = await db
    .select()
    .from(userSessions)
    .where(and(
      eq(userSessions.userId, session.user.id),
      eq(userSessions.sessionId, params.id)
    ))
    .get()

  if (!userAccess && savedSession.ownerId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Download ZIP from storage
  const zipBuffer = await downloadFromBlob(`/sessions/${params.id}/codebase.zip`)

  // Create in-memory session
  state.sessions.set(params.id, {
    id: params.id,
    name: savedSession.name,
    ownerId: savedSession.ownerId,
    users: new Set([session.user.id]),
    isSaved: true,
    zipUrl: savedSession.zipUrl,
    createdAt: savedSession.createdAt
  })

  state.sessionMap.set(session.user.id, params.id)

  return Response.json({
    session: savedSession,
    zip: zipBuffer.toString('base64')
  })
}
8. Delete Saved Session
typescript
// Client Side
async function deleteSavedSession(sessionId: string): Promise<void> {
  const confirmed = confirm('Delete this saved session?')
  if (!confirmed) return

  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete session')
  }
}

// Server Side
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership
  const savedSession = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, params.id))
    .get()

  if (!savedSession) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  if (savedSession.ownerId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if session is active
  const activeSession = state.sessions.get(params.id)
  if (activeSession && activeSession.users.size > 0) {
    return Response.json(
      { error: 'Cannot delete active session' },
      { status: 409 }
    )
  }

  // Delete from database
  await db.delete(sessions).where(eq(sessions.id, params.id))
  await db.delete(userSessions).where(eq(userSessions.sessionId, params.id))

  // Delete from storage
  await deleteFromBlob(`/sessions/${params.id}/codebase.zip`)

  return Response.json({ success: true })
}
📊 Session List
File: app/(dashboard)/sessions/page.tsx
typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Calendar, Trash2, FolderOpen } from 'lucide-react'

interface SavedSession {
  id: string
  name: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    try {
      const response = await fetch('/api/sessions')
      if (!response.ok) {
        throw new Error('Failed to load sessions')
      }
      const data = await response.json()
      setSessions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteSession(sessionId: string) {
    if (!confirm('Delete this saved session?')) return

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete')
      }

      setSessions(sessions.filter(s => s.id !== sessionId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function loadSession(sessionId: string) {
    try {
      await loadSavedSession(sessionId)
      router.push(`/session/${sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading...</div>
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Sessions</h1>
        <Button onClick={() => router.push('/session/new')}>
          New Session
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          {error}
        </Alert>
      )}

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No saved sessions yet</p>
            <Button onClick={() => router.push('/session/new')}>
              Create Your First Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="flex justify-between items-center p-4">
                <div className="flex-1">
                  <h3 className="font-semibold">{session.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </span>
                    <span>ID: {session.id.slice(0, 8)}...</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadSession(session.id)}
                  >
                    <FolderOpen size={16} className="mr-1" />
                    Open
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteSession(session.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
📝 API Routes Summary
Route	Method	Description
/api/sessions	GET	List saved sessions
/api/sessions	POST	Create new session
/api/sessions/[id]	GET	Load saved session
/api/sessions/[id]	DELETE	Delete saved session
/api/sessions/[id]/save	POST	Save session to storage
/api/sessions/check/[id]	GET	Check if session exists
🔍 Session Validation
File: lib/websocket/validation.ts
typescript
import { state } from './state'

export function validateSession(sessionId: string): {
  valid: boolean
  error?: string
} {
  // Check if session exists
  const session = state.sessions.get(sessionId)
  if (!session) {
    return { valid: false, error: 'Session not found' }
  }

  // Check if session is active (owner or temp owner online)
  const isOwnerOnline = state.connections.has(session.ownerId)
  const isTempOwnerOnline = session.tempOwnerId && state.connections.has(session.tempOwnerId)

  if (!isOwnerOnline && !isTempOwnerOnline) {
    return { valid: false, error: 'Session is not active' }
  }

  return { valid: true }
}

export function validateUserInSession(userId: string, sessionId: string): {
  valid: boolean
  error?: string
} {
  const session = state.sessions.get(sessionId)
  if (!session) {
    return { valid: false, error: 'Session not found' }
  }

  if (!session.users.has(userId)) {
    return { valid: false, error: 'User not in session' }
  }

  return { valid: true }
}
📈 Session Metrics
File: lib/websocket/metrics.ts
typescript
import { state } from './state'

export function getSessionMetrics() {
  const totalSessions = state.sessions.size
  const totalUsers = state.connections.size
  const totalSavedSessions = Array.from(state.sessions.values())
    .filter(s => s.isSaved).length

  const averageUsersPerSession = totalSessions > 0
    ? Array.from(state.sessions.values()).reduce((acc, s) => acc + s.users.size, 0) / totalSessions
    : 0

  return {
    totalSessions,
    totalUsers,
    totalSavedSessions,
    averageUsersPerSession,
    activeSessions: totalSessions,
    maxSessions: 100 // Configurable
  }
}
🧹 Cleanup
Session Cleanup Timer
typescript
// Clean up inactive sessions every 5 minutes
setInterval(() => {
  const now = Date.now()

  for (const [sessionId, session] of state.sessions) {
    // Check if owner is online
    const isOwnerOnline = state.connections.has(session.ownerId)
    const hasTempOwner = session.tempOwnerId && state.connections.has(session.tempOwnerId)

    if (!isOwnerOnline && !hasTempOwner) {
      // Close session
      closeSession(sessionId, 'Owner offline and no temp owner')
    }
  }
}, 5 * 60 * 1000) // 5 minutes
Next: Read 03-collaboration.md for real-time collaboration implementation.
```
