# GridCore - WebSocket Architecture

## 📋 Overview

The WebSocket server is the real-time communication backbone of GridCore. It runs on **Vercel Edge Runtime** using the `ws` library and handles all real-time features including collaboration diffs, cursor tracking, chat, and session management.

**Core Principle**: The WebSocket server is **stateless** and only broadcasts messages. All file state is maintained on clients.

---

## 🏗️ WebSocket Server Structure

```
┌─────────────────────────────────────────────────────────────┐
│ WebSocket Server │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Connection Handler ││
│ │ - Accepts WebSocket connections ││
│ │ - Validates JWT tokens ││
│ │ - Assigns connection to user/session ││
│ └────────────────────────────────────────────────────────┘│
│ │ │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Message Router ││
│ │ - Routes messages by event type ││
│ │ - Validates payloads ││
│ │ - Enforces rate limits ││
│ └────────────────────────────────────────────────────────┘│
│ │ │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Session Manager ││
│ │ - Manages active sessions in memory ││
│ │ - Tracks users in sessions ││
│ │ - Handles ownership logic ││
│ └────────────────────────────────────────────────────────┘│
│ │ │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Broadcast Engine ││
│ │ - Sends messages to all users in a session ││
│ │ - Handles message queuing ││
│ │ - Optimizes broadcast performance ││
│ └────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---
```

## 📦 WebSocket Server Implementation

### File: `app/api/websocket/route.ts`

```typescript
import { WebSocketServer, WebSocket } from 'ws'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { parse } from 'url'

// ─────────────────────────────────────────────────────────────
// 1. In-Memory State
// ─────────────────────────────────────────────────────────────

interface ServerState {
  sessions: Map<string, Session>
  connections: Map<string, WebSocket>
  sessionMap: Map<string, string> // userId → sessionId
  rateLimits: Map<string, RateLimit>
  chatCooldowns: Map<string, Date>
}

interface Session {
  id: string
  name: string
  ownerId: string
  tempOwnerId?: string
  users: Set<string>
  isSaved: boolean
  zipUrl?: string
  createdAt: Date
}

interface RateLimit {
  count: number
  resetTime: number
}

const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30 // 30 requests per minute
}

const CHAT_COOLDOWN = 10 * 1000 // 10 seconds
const MAX_USERS_PER_SESSION = 20
const MAX_MESSAGE_LENGTH = 200

const state: ServerState = {
  sessions: new Map(),
  connections: new Map(),
  sessionMap: new Map(),
  rateLimits: new Map(),
  chatCooldowns: new Map()
}

// ─────────────────────────────────────────────────────────────
// 2. WebSocket Server Setup
// ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // Parse the request
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  // Validate JWT token
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Upgrade to WebSocket
  const { socket, response } = upgradeWebSocket(req)

  const ws = new WebSocket(socket)

  // Store connection
  const userId = session.user.id
  state.connections.set(userId, ws)

  // ─────────────────────────────────────────────────────────
  // 3. Connection Handler
  // ─────────────────────────────────────────────────────────

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString())
      await handleMessage(message, userId, ws)
    } catch (error) {
      console.error('Error handling message:', error)
      sendError(ws, 'Invalid message format')
    }
  })

  ws.on('close', () => {
    handleDisconnect(userId)
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
    handleDisconnect(userId)
  })

  return response
}

// ─────────────────────────────────────────────────────────────
// 4. Message Handler
// ─────────────────────────────────────────────────────────────

async function handleMessage(message: any, userId: string, ws: WebSocket) {
  const { type, payload } = message

  // Rate limiting
  if (!checkRateLimit(userId)) {
    sendError(ws, 'Rate limit exceeded')
    return
  }

  // Route message by type
  switch (type) {
    case 'join':
      await handleJoin(payload, userId, ws)
      break
    case 'leave':
      await handleLeave(payload, userId)
      break
    case 'diff':
      await handleDiff(payload, userId)
      break
    case 'cursor':
      await handleCursor(payload, userId)
      break
    case 'status':
      await handleStatus(payload, userId)
      break
    case 'chat':
      await handleChat(payload, userId)
      break
    case 'file:create':
      await handleFileCreate(payload, userId)
      break
    case 'file:delete':
      await handleFileDelete(payload, userId)
      break
    case 'file:rename':
      await handleFileRename(payload, userId)
      break
    case 'session:save':
      await handleSessionSave(payload, userId)
      break
    case 'session:close':
      await handleSessionClose(payload, userId)
      break
    case 'session:id-change':
      await handleSessionIdChange(payload, userId)
      break
    case 'ownership:grant':
      await handleOwnershipGrant(payload, userId)
      break
    case 'ownership:revoke':
      await handleOwnershipRevoke(payload, userId)
      break
    default:
      sendError(ws, 'Unknown event type')
  }
}

// ─────────────────────────────────────────────────────────────
// 5. Event Handlers
// ─────────────────────────────────────────────────────────────

// 5.1 Join Session
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
  if (session.users.size >= MAX_USERS_PER_SESSION) {
    sendError(ws, 'Session is full (max 20 users)')
    return
  }

  // Check if owner is online (unless temp owner exists)
  const isOwnerOnline = state.connections.has(session.ownerId)
  const isTempOwnerOnline = session.tempOwnerId && state.connections.has(session.tempOwnerId)

  if (!isOwnerOnline && !isTempOwnerOnline) {
    sendError(ws, 'Session is not active (no owner online)')
    return
  }

  // Add user to session
  session.users.add(userId)
  state.sessionMap.set(userId, sessionId)

  // Request codebase from owner or temp owner
  const providerId = isOwnerOnline ? session.ownerId : session.tempOwnerId!
  const providerWs = state.connections.get(providerId)

  if (providerWs) {
    // Request ZIP from provider
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

  // Send current session state to new user
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

// 5.2 Leave Session
async function handleLeave(payload: { sessionId: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  // Remove user from session
  session.users.delete(userId)
  state.sessionMap.delete(userId)

  // If user was temp owner, remove temp owner status
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
      // Session continues with temp owner
      broadcastToSession(payload.sessionId, {
        type: 'ownership:transferred',
        payload: { tempOwnerId: session.tempOwnerId }
      })
    } else if (hasUsers) {
      // No temp owner, but there are users - close session
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

// 5.3 Diff Handling
async function handleDiff(payload: { sessionId: string; diff: any; filePath: string }, userId: string) {
  const sessionId = payload.sessionId
  const session = state.sessions.get(sessionId)
  if (!session || !session.users.has(userId)) return

  // Broadcast diff to all users in session except sender
  broadcastToSession(sessionId, {
    type: 'diff',
    payload: {
      userId,
      filePath: payload.filePath,
      diff: payload.diff
    }
  }, [userId]) // Exclude sender
}

// 5.4 Cursor Tracking
async function handleCursor(payload: { sessionId: string; filePath: string; position: { line: number; column: number } }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session || !session.users.has(userId)) return

  broadcastToSession(payload.sessionId, {
    type: 'cursor',
    payload: {
      userId,
      filePath: payload.filePath,
      position: payload.position
    }
  }, [userId]) // Exclude sender
}

// 5.5 User Status
async function handleStatus(payload: { sessionId: string; filePath: string; status: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session || !session.users.has(userId)) return

  broadcastToSession(payload.sessionId, {
    type: 'status',
    payload: {
      userId,
      filePath: payload.filePath,
      status: payload.status
    }
  }, [userId])
}

// 5.6 Chat Messages
async function handleChat(payload: { sessionId: string; content: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session || !session.users.has(userId)) return

  // Validate message length
  if (payload.content.length > MAX_MESSAGE_LENGTH) {
    sendError(state.connections.get(userId), 'Message exceeds 200 characters')
    return
  }

  // Check cooldown
  const lastMessage = state.chatCooldowns.get(userId)
  if (lastMessage && Date.now() - lastMessage.getTime() < CHAT_COOLDOWN) {
    sendError(state.connections.get(userId), 'Please wait before sending another message')
    return
  }

  // Update cooldown
  state.chatCooldowns.set(userId, new Date())

  // Broadcast chat message to all users in session
  broadcastToSession(payload.sessionId, {
    type: 'chat',
    payload: {
      userId,
      content: payload.content,
      timestamp: new Date().toISOString()
    }
  })
}

// 5.7 File Create (Owner or Temp Owner only)
async function handleFileCreate(payload: { sessionId: string; path: string; content?: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session || !session.users.has(userId)) return

  // Check if user is owner or temp owner
  const isOwner = userId === session.ownerId
  const isTempOwner = userId === session.tempOwnerId

  if (!isOwner && !isTempOwner) {
    sendError(state.connections.get(userId), 'Only owners can create files')
    return
  }

  // Broadcast file create event
  broadcastToSession(payload.sessionId, {
    type: 'file:created',
    payload: {
      userId,
      path: payload.path,
      content: payload.content || ''
    }
  })
}

// 5.8 File Delete (Owner or Temp Owner only)
async function handleFileDelete(payload: { sessionId: string; path: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session || !session.users.has(userId)) return

  const isOwner = userId === session.ownerId
  const isTempOwner = userId === session.tempOwnerId

  if (!isOwner && !isTempOwner) {
    sendError(state.connections.get(userId), 'Only owners can delete files')
    return
  }

  broadcastToSession(payload.sessionId, {
    type: 'file:deleted',
    payload: {
      userId,
      path: payload.path
    }
  })
}

// 5.9 File Rename (Owner or Temp Owner only)
async function handleFileRename(payload: { sessionId: string; oldPath: string; newPath: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session || !session.users.has(userId)) return

  const isOwner = userId === session.ownerId
  const isTempOwner = userId === session.tempOwnerId

  if (!isOwner && !isTempOwner) {
    sendError(state.connections.get(userId), 'Only owners can rename files')
    return
  }

  broadcastToSession(payload.sessionId, {
    type: 'file:renamed',
    payload: {
      userId,
      oldPath: payload.oldPath,
      newPath: payload.newPath
    }
  })
}

// 5.10 Session Save (Owner only)
async function handleSessionSave(payload: { sessionId: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  if (userId !== session.ownerId) {
    sendError(state.connections.get(userId), 'Only owner can save session')
    return
  }

  // Request ZIP from owner
  const ownerWs = state.connections.get(session.ownerId)
  if (ownerWs) {
    ownerWs.send(JSON.stringify({
      type: 'request:save',
      payload: { sessionId: payload.sessionId }
    }))
  }
}

// 5.11 Session Close
async function handleSessionClose(payload: { sessionId: string; save: boolean }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  const isOwner = userId === session.ownerId
  const isTempOwner = userId === session.tempOwnerId

  // Only last owner can close session
  if (!isOwner && !isTempOwner) {
    sendError(state.connections.get(userId), 'Only owners can close the session')
    return
  }

  if (payload.save && isOwner) {
    // Request save before closing
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

// 5.12 Session ID Change (Owner only)
async function handleSessionIdChange(payload: { sessionId: string; newSessionId: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  if (userId !== session.ownerId) {
    sendError(state.connections.get(userId), 'Only owner can change session ID')
    return
  }

  // Generate new session ID
  const newSessionId = crypto.randomUUID()

  // Update session
  const sessionData = state.sessions.get(payload.sessionId)
  if (sessionData) {
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

    // Broadcast new session ID to all users
    broadcastToSession(newSessionId, {
      type: 'session:id-changed',
      payload: {
        oldSessionId: payload.sessionId,
        newSessionId
      }
    })
  }
}

// 5.13 Ownership Grant (Owner only)
async function handleOwnershipGrant(payload: { sessionId: string; userId: string }, grantorId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  if (grantorId !== session.ownerId) {
    sendError(state.connections.get(grantorId), 'Only main owner can grant temporary ownership')
    return
  }

  if (!session.users.has(payload.userId)) {
    sendError(state.connections.get(grantorId), 'User is not in session')
    return
  }

  session.tempOwnerId = payload.userId

  broadcastToSession(payload.sessionId, {
    type: 'ownership:granted',
    payload: {
      userId: payload.userId
    }
  })
}

// 5.14 Ownership Revoke (Owner only)
async function handleOwnershipRevoke(payload: { sessionId: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  if (userId !== session.ownerId) {
    sendError(state.connections.get(userId), 'Only main owner can revoke temporary ownership')
    return
  }

  const tempOwnerId = session.tempOwnerId
  session.tempOwnerId = undefined

  broadcastToSession(payload.sessionId, {
    type: 'ownership:revoked',
    payload: {
      userId: tempOwnerId
    }
  })
}

// ─────────────────────────────────────────────────────────────
// 6. Utility Functions
// ─────────────────────────────────────────────────────────────

// Broadcast to all users in a session
function broadcastToSession(sessionId: string, message: any, excludeUsers: string[] = []) {
  const session = state.sessions.get(sessionId)
  if (!session) return

  const messageStr = JSON.stringify(message)

  for (const userId of session.users) {
    if (excludeUsers.includes(userId)) continue

    const ws = state.connections.get(userId)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr)
    }
  }
}

// Close a session
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

  // Clean up chat cooldowns for users in this session
  for (const userId of session.users) {
    state.chatCooldowns.delete(userId)
  }
}

// Handle disconnection
function handleDisconnect(userId: string) {
  const sessionId = state.sessionMap.get(userId)
  if (!sessionId) return

  // Remove user from session
  const session = state.sessions.get(sessionId)
  if (session) {
    session.users.delete(userId)
    state.sessionMap.delete(userId)
    state.connections.delete(userId)

    // If temp owner disconnects
    if (session.tempOwnerId === userId) {
      session.tempOwnerId = undefined
    }

    // If owner disconnects
    if (session.ownerId === userId) {
      if (session.tempOwnerId && session.users.has(session.tempOwnerId)) {
        // Transfer to temp owner
        broadcastToSession(sessionId, {
          type: 'ownership:transferred',
          payload: { tempOwnerId: session.tempOwnerId }
        })
      } else if (session.users.size > 0) {
        // Close session
        closeSession(sessionId, 'Owner disconnected without temp owner')
      } else {
        // No users left
        state.sessions.delete(sessionId)
      }
    } else if (session.users.size === 0) {
      // Last user left
      state.sessions.delete(sessionId)
    }
  }

  // Clean up rate limits
  state.rateLimits.delete(userId)
  state.chatCooldowns.delete(userId)
}

// Rate limiting
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const record = state.rateLimits.get(userId)

  if (!record || now > record.resetTime) {
    state.rateLimits.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs
    })
    return true
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    return false
  }

  record.count++
  return true
}

// Send error to client
function sendError(ws: WebSocket | undefined, error: string) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { error }
    }))
  }
}

// WebSocket upgrade helper
function upgradeWebSocket(req: Request): { socket: any; response: Response } {
  // Vercel WebSocket upgrade implementation
  // This is a placeholder - actual implementation depends on Vercel's WebSocket support
  const { socket, response } = (req as any).upgrade()
  return { socket, response }
}
📊 WebSocket Message Protocol
Message Format
typescript
interface WSMessage {
  type: WebSocketEventType
  payload: any
  timestamp?: number
}

type WebSocketEventType =
  // Session events
  | 'join'
  | 'leave'
  | 'session:state'
  | 'session:closed'
  | 'session:id-changed'

  // Collaboration events
  | 'diff'
  | 'cursor'
  | 'status'

  // File events
  | 'file:created'
  | 'file:deleted'
  | 'file:renamed'

  // Chat events
  | 'chat'

  // Ownership events
  | 'ownership:granted'
  | 'ownership:revoked'
  | 'ownership:transferred'

  // System events
  | 'request:zip'
  | 'request:save'
  | 'session:save'
  | 'session:close'
  | 'session:id-change'
  | 'error'

  // User events
  | 'user:joined'
  | 'user:left'
Event Payloads
Join
typescript
// Client → Server
{
  type: 'join',
  payload: {
    sessionId: string
  }
}

// Server → Client
{
  type: 'session:state',
  payload: {
    sessionId: string,
    sessionName: string,
    ownerId: string,
    tempOwnerId?: string,
    users: string[],
    isSaved: boolean
  }
}
Diff
typescript
// Client → Server
{
  type: 'diff',
  payload: {
    sessionId: string,
    filePath: string,
    diff: any // yjs diff
  }
}

// Server → Client
{
  type: 'diff',
  payload: {
    userId: string,
    filePath: string,
    diff: any
  }
}
Cursor
typescript
// Client → Server
{
  type: 'cursor',
  payload: {
    sessionId: string,
    filePath: string,
    position: {
      line: number,
      column: number
    }
  }
}

// Server → Client
{
  type: 'cursor',
  payload: {
    userId: string,
    filePath: string,
    position: {
      line: number,
      column: number
    }
  }
}
Chat
typescript
// Client → Server
{
  type: 'chat',
  payload: {
    sessionId: string,
    content: string // max 200 chars
  }
}

// Server → Client
{
  type: 'chat',
  payload: {
    userId: string,
    content: string,
    timestamp: string
  }
}
🔒 Security
Authentication
JWT Token: Required for WebSocket connection

Session Validation: User must be in session to send messages

Ownership Validation: Only owners can perform privileged actions

Rate Limiting
30 messages per minute per user

Chat cooldown: 10 seconds between messages

Connection limit: 1 connection per user

Session Isolation
Users cannot send messages to sessions they're not in

Session IDs are UUIDs (unguessable)

Old session IDs break immediately on change

📈 Performance Optimization
Broadcast Optimization
typescript
// Batch multiple broadcasts
const broadcastQueue = new Map<string, any[]>()

function batchBroadcast(sessionId: string, message: any) {
  if (!broadcastQueue.has(sessionId)) {
    broadcastQueue.set(sessionId, [])
  }
  broadcastQueue.get(sessionId)!.push(message)

  // Send every 100ms
  setTimeout(() => {
    const messages = broadcastQueue.get(sessionId)
    if (messages && messages.length > 0) {
      const combined = messages.map(m => JSON.stringify(m)).join('\n')
      const session = state.sessions.get(sessionId)
      if (session) {
        for (const userId of session.users) {
          const ws = state.connections.get(userId)
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(combined)
          }
        }
      }
      broadcastQueue.delete(sessionId)
    }
  }, 100)
}
Connection Management
typescript
// Ping/Pong for connection health
setInterval(() => {
  for (const [userId, ws] of state.connections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping()
    }
  }
}, 30000)

// Handle ping responses
ws.on('pong', () => {
  // Connection is alive
})
🧹 Cleanup
Automatic Cleanup
typescript
// Clean up inactive sessions every 5 minutes
setInterval(() => {
  const now = Date.now()

  for (const [sessionId, session] of state.sessions) {
    // Remove sessions with no users
    if (session.users.size === 0) {
      state.sessions.delete(sessionId)
      continue
    }

    // Check if owner is online
    const isOwnerOnline = state.connections.has(session.ownerId)
    const hasTempOwner = session.tempOwnerId && state.connections.has(session.tempOwnerId)

    if (!isOwnerOnline && !hasTempOwner) {
      closeSession(sessionId, 'Owner offline and no temp owner')
    }
  }

  // Clean up rate limits
  for (const [userId, limit] of state.rateLimits) {
    if (now > limit.resetTime) {
      state.rateLimits.delete(userId)
    }
  }
}, 5 * 60 * 1000) // 5 minutes
📝 Monitoring
### Health Check

```typescript
// Add health check endpoint
export async function GET_health() {
  return Response.json({
    status: 'ok',
    sessions: state.sessions.size,
    connections: state.connections.size,
    rateLimits: state.rateLimits.size
  })
}
```

### Logging

```typescript
function logEvent(event: string, data: any) {
  console.log({
    timestamp: new Date().toISOString(),
    event,
    data
  })
}
```

## 🚀 Scaling Considerations

### Current Architecture (Single Server)

- Max sessions: Limited by memory (~100 sessions)
- Max users: ~1000 concurrent users
- State: In-memory (lost on restart)

### Future Architecture (With Redis)

```
┌─────────────────────────────────────────────────────────────┐
│                    Multiple WebSocket Servers               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Server 1    │  │  Server 2    │  │  Server 3    │     │
│  │  (In-Memory) │  │  (In-Memory) │  │  (In-Memory) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                         │
│                    │   Redis     │                         │
│                    │(Shared State)│                         │
│                    └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

Next: Read [05-database.md](05-database.md) for database architecture details.
