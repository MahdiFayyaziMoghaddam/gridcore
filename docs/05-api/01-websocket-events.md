# GridCore - WebSocket Events

## 📋 Overview

This document defines all WebSocket events used in GridCore for real-time communication. The WebSocket server uses a **message-based protocol** where each message has a `type` and `payload`.

---

## 📦 Message Format

### Base Message Structure

```typescript
interface WSMessage {
  type: WebSocketEventType
  payload: any
  timestamp?: number
}

```typescript
```

## 🔌 Session Events

### 1. Join Session

Direction: Client → Server

```typescript
// Client sends
{
  type: 'join',
  payload: {
    sessionId: string
  }
}
```

// Server responds
```typescript
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
```

// Server broadcasts to all users
```typescript
{
  type: 'user:joined',
  payload: {
    userId: string,
    userName: string,
    color: string
  }
}
```

### 2. Leave Session

Direction: Client → Server

```typescript
// Client sends
{
  type: 'leave',
  payload: {
    sessionId: string
  }
}
```

// Server broadcasts
{
  type: 'user:left',
  payload: {
    userId: string
  }
}
3. Close Session
Direction: Client → Server

typescript
// Client sends (owner only)
{
  type: 'session:close',
  payload: {
    sessionId: string,
    save: boolean // Whether to save before closing
  }
}

// Server broadcasts

```typescript
{
  type: 'session:closed',
  payload: {
    reason: string
  }
}
```

### 4. Save Session

Direction: Client → Server

```typescript
// Client sends (owner only)
{
  type: 'session:save',
  payload: {
    sessionId: string
  }
}
```

// Server broadcasts
```typescript
{
  type: 'session:saved',
  payload: {
    sessionId: string,
    savedAt: string
  }
}
```

### 5. Change Session ID

Direction: Client → Server

```typescript
// Client sends (owner only)
{
  type: 'session:id-change',
  payload: {
    sessionId: string,
    newSessionId: string
  }
}
```

// Server broadcasts
```typescript
{
  type: 'session:id-changed',
  payload: {
    oldSessionId: string,
    newSessionId: string
  }
}
```

## 🤝 Collaboration Events

### 1. Diff (File Change)
Direction: Client → Server → Clients

typescript
// Client sends
{
  type: 'diff',
  payload: {
    sessionId: string,
    filePath: string,
    diff: any // yjs diff
  }
}

// Server broadcasts (excluding sender)
{
  type: 'diff',
  payload: {
    userId: string,
    filePath: string,
    diff: any
  }
}
2. Cursor Position
Direction: Client → Server → Clients

typescript
// Client sends
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

// Server broadcasts (excluding sender)
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
3. User Status
Direction: Client → Server → Clients

typescript
// Client sends
{
  type: 'status',
  payload: {
    sessionId: string,
    filePath: string,
    status: 'idle' | 'editing' | 'viewing'
  }
}

// Server broadcasts (excluding sender)
{
  type: 'status',
  payload: {
    userId: string,
    filePath: string,
    status: 'idle' | 'editing' | 'viewing'
  }
}
📁 File Events
1. Create File
Direction: Client → Server → Clients

typescript
// Client sends (owner or temp owner only)
{
  type: 'file:create',
  payload: {
    sessionId: string,
    path: string,
    content?: string
  }
}

// Server broadcasts
{
  type: 'file:created',
  payload: {
    userId: string,
    path: string,
    content?: string
  }
}
2. Delete File
Direction: Client → Server → Clients

typescript
// Client sends (owner or temp owner only)
{
  type: 'file:delete',
  payload: {
    sessionId: string,
    path: string
  }
}

// Server broadcasts
{
  type: 'file:deleted',
  payload: {
    userId: string,
    path: string
  }
}
3. Rename File
Direction: Client → Server → Clients

typescript
// Client sends (owner or temp owner only)
{
  type: 'file:rename',
  payload: {
    sessionId: string,
    oldPath: string,
    newPath: string
  }
}

// Server broadcasts
{
  type: 'file:renamed',
  payload: {
    userId: string,
    oldPath: string,
    newPath: string
  }
}
💬 Chat Events
Send Chat Message
Direction: Client → Server → Clients

typescript
// Client sends
{
  type: 'chat',
  payload: {
    sessionId: string,
    content: string // max 200 chars
  }
}

// Server broadcasts
{
  type: 'chat',
  payload: {
    userId: string,
    userName: string,
    content: string,
    timestamp: string
  }
}

// Server error response
{
  type: 'error',
  payload: {
    error: string // e.g., "Message exceeds 200 characters"
  }
}
👑 Ownership Events
1. Grant Temp Owner
Direction: Client → Server → Clients

typescript
// Client sends (owner only)
{
  type: 'ownership:grant',
  payload: {
    sessionId: string,
    userId: string
  }
}

// Server broadcasts
{
  type: 'ownership:granted',
  payload: {
    userId: string,
    grantedBy: string
  }
}

// Server sends to new temp owner
{
  type: 'ownership:promoted',
  payload: {
    sessionId: string,
    role: 'temp_owner'
  }
}
2. Revoke Temp Owner
Direction: Client → Server → Clients

typescript
// Client sends (owner only)
{
  type: 'ownership:revoke',
  payload: {
    sessionId: string
  }
}

// Server broadcasts
{
  type: 'ownership:revoked',
  payload: {
    userId: string,
    revokedBy: string
  }
}

// Server sends to demoted user
{
  type: 'ownership:demoted',
  payload: {
    sessionId: string,
    role: 'user'
  }
}
3. Transfer Ownership (Owner Leaves)
Direction: Server → Clients

typescript
// Server broadcasts when owner leaves
{
  type: 'ownership:transferred',
  payload: {
    tempOwnerId: string,
    reason: string
  }
}

// Server broadcasts when owner returns
{
  type: 'ownership:reclaimed',
  payload: {
    ownerId: string,
    tempOwnerId: string,
    reason: string
  }
}
📍 Presence Events
1. User Joined
Direction: Server → Clients

typescript
{
  type: 'user:joined',
  payload: {
    userId: string,
    userName: string,
    color: string
  }
}
2. User Left
Direction: Server → Clients

typescript
{
  type: 'user:left',
  payload: {
    userId: string
  }
}
3. User Status Update
Direction: Server → Clients

typescript
{
  type: 'user:status',
  payload: {
    userId: string,
    status: 'online' | 'idle' | 'editing' | 'away'
  }
}
4. User Cursor Update
Direction: Server → Clients

typescript
{
  type: 'user:cursor',
  payload: {
    userId: string,
    cursor: {
      filePath: string,
      line: number,
      column: number
    }
  }
}
5. User File Update
Direction: Server → Clients

typescript
{
  type: 'user:file',
  payload: {
    userId: string,
    filePath: string
  }
}
🔄 System Events
1. Request ZIP
Direction: Server → Client

typescript
// Server requests ZIP from provider
{
  type: 'request:zip',
  payload: {
    targetUserId: string
  }
}

// Client responds with ZIP
{
  type: 'send:zip',
  payload: {
    targetUserId: string,
    zip: string // base64 encoded
  }
}

// Server forwards to target
{
  type: 'receive:zip',
  payload: {
    zip: string // base64 encoded
  }
}
2. Request Save
Direction: Server → Client

typescript
// Server requests save from owner
{
  type: 'request:save',
  payload: {
    sessionId: string,
    closeAfterSave?: boolean
  }
}
3. Error
Direction: Server → Client

typescript
{
  type: 'error',
  payload: {
    error: string,
    code?: string
  }
}
📊 Event Flow Diagrams
Join Flow
text
Client A          Server          Client B
  │                 │                 │
  │─ join ─────────▶│                 │
  │                 │                 │
  │◀─ session:state─│                 │
  │                 │                 │
  │                 │── user:joined ──▶│
  │                 │                 │
  │                 │◀─ user:joined ──│ (if B joins)
  │                 │                 │
Edit Flow
text
Client A          Server          Client B
  │                 │                 │
  │─ diff ─────────▶│                 │
  │                 │                 │
  │                 │── diff ────────▶│
  │                 │                 │
  │                 │                 │
  │                 │◀── diff ────────│ (if B edits)
  │                 │                 │
Chat Flow
text
Client A          Server          Client B
  │                 │                 │
  │─ chat ─────────▶│                 │
  │ (validated)     │                 │
  │                 │                 │
  │                 │── chat ────────▶│
  │                 │                 │
  │                 │◀── chat ────────│ (if B chats)
  │                 │                 │
🛡️ Error Codes
typescript
// lib/websocket/errors.ts
export const WebSocketErrorCodes = {
  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_FULL: 'SESSION_FULL',
  SESSION_INACTIVE: 'SESSION_INACTIVE',
  ALREADY_IN_SESSION: 'ALREADY_IN_SESSION',

  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_IN_SESSION: 'NOT_IN_SESSION',
  OWNER_REQUIRED: 'OWNER_REQUIRED',

  // Chat errors
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
  EMPTY_MESSAGE: 'EMPTY_MESSAGE',
  CHAT_COOLDOWN: 'CHAT_COOLDOWN',

  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD'
}
📝 Event Validation
File: lib/websocket/validation.ts
typescript
import { z } from 'zod'

// Session events
export const JoinSchema = z.object({
  sessionId: z.string().uuid()
})

export const LeaveSchema = z.object({
  sessionId: z.string().uuid()
})

export const CloseSessionSchema = z.object({
  sessionId: z.string().uuid(),
  save: z.boolean().optional()
})

// Collaboration events
export const DiffSchema = z.object({
  sessionId: z.string().uuid(),
  filePath: z.string().min(1),
  diff: z.any()
})

export const CursorSchema = z.object({
  sessionId: z.string().uuid(),
  filePath: z.string().min(1),
  position: z.object({
    line: z.number().int().min(0),
    column: z.number().int().min(0)
  })
})

// Chat events
export const ChatSchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1).max(200)
})

// File events
export const FileCreateSchema = z.object({
  sessionId: z.string().uuid(),
  path: z.string().min(1),
  content: z.string().optional()
})

export const FileDeleteSchema = z.object({
  sessionId: z.string().uuid(),
  path: z.string().min(1)
})

export const FileRenameSchema = z.object({
  sessionId: z.string().uuid(),
  oldPath: z.string().min(1),
  newPath: z.string().min(1)
})

// Ownership events
export const GrantOwnerSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid()
})

export const RevokeOwnerSchema = z.object({
  sessionId: z.string().uuid()
})

// Session ID change
export const ChangeSessionIdSchema = z.object({
  sessionId: z.string().uuid(),
  newSessionId: z.string().uuid().optional()
})
Next: Read 02-rest-endpoints.md for REST API documentation.
```
