# GridCore - Architecture Overview

## 🏗️ System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLIENT (Browser) │
├─────────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Next.js App │ │ Monaco │ │ yjs (CRDT) │ │ Zustand │ │
│ │ (React) │ │ Editor │ │ Client │ │ State │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │
│ │ │ │ │ │
│ └────────────────┼────────────────┼────────────────┘ │
│ │ │ │
│ ┌─────▼────────────────▼─────┐ │
│ │ WebSocket Connection │ │
│ │ (Client-side WS) │ │
│ └────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────────┘
│
│ WebSocket (WSS)
│
▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ WEBSOCKET SERVER (Vercel) │
├─────────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ In-Memory State │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Sessions │ │ Connections │ │ Rate Limits │ │ │
│ │ │ Map │ │ Map │ │ Map │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ │ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Chat │ │ Session │ │ │
│ │ │ Cooldowns │ │ Metadata │ │ │
│ │ └──────────────┘ └──────────────┘ │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Connection │ │ Message │ │ Session │ │
│ │ Handler │──▶│ Router │──▶│ Manager │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
│ │ │ │ │
│ └────────────────┼────────────────┘ │
│ │ │
│ ┌─────▼─────┐ │
│ │ Storage │ │
│ │ Adapter │ │
│ └───────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────────┘
│
│ HTTP / HTTPS
│
▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ DATABASE & STORAGE (Vercel) │
├─────────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌──────────────────────┐ ┌──────────────────────────────────────────┐ │
│ │ PostgreSQL │ │ Vercel Blob Storage │ │
│ │ (Drizzle ORM) │ │ │ │
│ │ │ │ /sessions/{id}/codebase.zip │ │
│ │ ┌─────────────────┐ │ │ │ │
│ │ │ users │ │ │ Max file size: 50MB │ │
│ │ │ sessions │ │ │ │ │
│ │ │ user_sessions │ │ │ │ │
│ │ └─────────────────┘ │ │ │ │
│ └──────────────────────┘ └──────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Architecture

### 1. User Joins a Session

User → Enters Session ID → Client sends "join" via WebSocket
Server → Checks if session exists and user is authenticated
Server → If session active (owner/temp owner online)
Server → Requests ZIP from owner/temp owner client
Owner Client → Creates ZIP → Sends to Server
Server → Forwards ZIP to new user
New User → Extracts ZIP → Loads codebase → Renders editor
Server → Broadcasts "User joined" to all users

### 2. Collaborative Editing

User A → Edits file → yjs generates diff
Client A → Sends "diff" via WebSocket
Server → Broadcasts "diff" to all users in session
Client B → Receives diff → yjs applies locally
Client B → Editor updates
All Users → See synchronized changes

### 3. Saving a Session

Owner → Clicks "Save Session"
Owner Client → Creates ZIP of entire codebase
Owner Client → Uploads ZIP to Vercel Blob Storage
Owner Client → Sends metadata to Server via WebSocket
Server → Saves to PostgreSQL database
Server → Broadcasts "Session Saved" (no notification)

### 4. Closing a Session

Owner → Clicks "Close Session" or disconnects
Client → Shows warning if unsaved (if last owner)
Client → If saving: Save process runs
Client → Sends "leave" via WebSocket
Server → Removes user from session
Server → If no users left: Session ends
Server → If owner: Check for temp owner
Server → If no temp owner: Session closes entirely

---

## 📂 Project Structure Overview

gridcore/
├── app/ # Next.js App Router
│ ├── (auth)/ # Authentication routes
│ │ ├── login/
│ │ ├── register/
│ │ └── layout.tsx
│ ├── (dashboard)/ # Main app routes
│ │ ├── session/
│ │ │ ├── [id]/
│ │ │ │ └── page.tsx # Session page
│ │ │ └── join/
│ │ │ └── page.tsx # Join session page
│ │ ├── sessions/
│ │ │ └── page.tsx # Saved sessions list
│ │ └── layout.tsx # Main app layout
│ ├── api/ # API routes
│ │ ├── auth/
│ │ │ └── [...nextauth]/
│ │ │ └── route.ts
│ │ ├── websocket/
│ │ │ └── route.ts # WebSocket server
│ │ ├── sessions/
│ │ │ ├── route.ts # GET (list), POST (create)
│ │ │ └── [id]/
│ │ │ ├── route.ts # GET (load), DELETE
│ │ │ └── save/
│ │ │ └── route.ts # POST (save)
│ │ └── users/
│ │ └── me/
│ │ └── route.ts # GET (current user)
│ ├── layout.tsx # Root layout
│ └── page.tsx # Landing page
│
├── components/ # React components
│ ├── ui/ # Reusable UI components
│ │ ├── Button/
│ │ ├── Input/
│ │ ├── Card/
│ │ ├── Dialog/
│ │ ├── Toast/
│ │ └── ...
│ ├── layout/ # Layout components
│ │ ├── Navbar.tsx
│ │ ├── Sidebar.tsx
│ │ ├── StatusBar.tsx
│ │ └── MainContent.tsx
│ ├── editor/ # Editor components
│ │ ├── Editor.tsx
│ │ ├── EditorTabs.tsx
│ │ ├── FileTree.tsx
│ │ └── FileIcon.tsx
│ ├── collaboration/ # Collaboration components
│ │ ├── CursorOverlay.tsx
│ │ ├── UserList.tsx
│ │ └── UserStatus.tsx
│ ├── chat/ # Chat components
│ │ ├── ChatPanel.tsx
│ │ ├── ChatMessage.tsx
│ │ └── ChatInput.tsx
│ └── session/ # Session components
│ ├── SessionControls.tsx
│ ├── SaveDialog.tsx
│ └── ImportDialog.tsx
│
├── lib/ # Core libraries
│ ├── websocket/ # WebSocket client
│ │ ├── client.ts
│ │ ├── events.ts
│ │ └── types.ts
│ ├── collaboration/ # yjs integration
│ │ ├── yjs.ts
│ │ ├── awareness.ts
│ │ └── provider.ts
│ ├── file-system/ # File system operations
│ │ ├── file-tree.ts
│ │ ├── zip.ts
│ │ └── types.ts
│ ├── auth/ # Authentication
│ │ └── nextauth.ts
│ ├── db/ # Database
│ │ ├── index.ts
│ │ ├── schema.ts
│ │ └── migrations/
│ └── storage/ # Storage
│ └── blob.ts
│
├── hooks/ # Custom React hooks
│ ├── useWebSocket.ts
│ ├── useCollaboration.ts
│ ├── useSession.ts
│ ├── useFileSystem.ts
│ ├── useChat.ts
│ └── usePresence.ts
│
├── stores/ # Zustand stores
│ ├── sessionStore.ts
│ ├── editorStore.ts
│ ├── fileStore.ts
│ ├── userStore.ts
│ └── chatStore.ts
│
├── types/ # TypeScript types
│ ├── session.ts
│ ├── file.ts
│ ├── user.ts
│ ├── websocket.ts
│ └── index.ts
│
├── utils/ # Utilities
│ ├── constants.ts
│ ├── helpers.ts
│ └── validators.ts
│
├── middleware.ts # Next.js middleware
├── next.config.js # Next.js configuration
├── drizzle.config.ts # Drizzle configuration
├── tailwind.config.ts # Tailwind configuration
├── package.json
└── .env.example

---

## 🧩 Core Abstractions

### Session Abstraction

```typescript
interface Session {
  id: string                    // UUID
  name: string                  // Session name (optional, fallback generated)
  ownerId: string               // Main owner user ID
  tempOwnerId?: string          // Temporary owner user ID (optional)
  users: Set<string>            // Set of user IDs in session
  isSaved: boolean              // Whether session is saved to database
  zipUrl?: string               // URL to stored ZIP (if saved)
  createdAt: Date
}
```

### User Abstraction

```typescript
interface User {
  id: string
  name: string
  email: string
  password?: string             // Hashed (for email/password auth)
  githubId?: string
  googleId?: string
  createdAt: Date
}
### File Abstraction

```typescript
interface File {
  path: string                  // Full path including filename
  name: string                  // Filename
  content: string               // File content (text only)
  type: 'file' | 'folder'
  children?: File[]             // For folders
  extension?: string            // File extension (e.g., 'ts', 'js')
}
### WebSocket Message Abstraction

```typescript
interface WSMessage {
  type: WebSocketEventType
  payload: any
  userId: string
  sessionId: string
  timestamp: number
}

type WebSocketEventType =
  | 'join'
  | 'leave'
  | 'diff'
  | 'cursor'
  | 'status'
  | 'chat'
  | 'file:create'
  | 'file:delete'
  | 'file:rename'
  | 'session:save'
  | 'session:close'
  | 'session:id-change'
  | 'ownership:grant'
  | 'ownership:revoke'
  | 'error'
```
## 🔌 Integration Points

### WebSocket Server Integration
Port: Uses Next.js API route /api/websocket

Protocol: WebSocket over WSS in production

Authentication: WebSocket connection validates JWT token

State: In-memory only (no Redis)

### Database Integration
Connection: PostgreSQL via Drizzle ORM

Pooling: Connection pooling enabled

Migrations: Drizzle migrations

Relationships: Foreign keys between users, sessions, user_sessions

### Storage Integration
Service: Vercel Blob Storage

Path: /sessions/{sessionId}/codebase.zip

Access: Upload via token, download via URL

Limits: 50MB per file

### Auth Integration
Providers: Email/Password, GitHub, Google

Session: JWT-based

Middleware: Protects API routes and pages

Callbacks: Handles OAuth user creation

## 🔒 Security Architecture

### Authentication Flow
1. User logs in via NextAuth
2. NextAuth creates JWT session token
3. Token is stored in cookie
4. Token is validated on each request
5. WebSocket connection validates token
### Authorization Flow
1. User sends request with session ID
2. Server checks if user is in session
3. Server checks user role (owner, temp owner, regular)
4. Server allows/denies action based on role
5. All actions are validated server-side
### Data Protection Flow

1. All passwords hashed with bcrypt
2. All connections use HTTPS/WSS
3. Database credentials stored as environment variables
4. No sensitive data in client-side storage
5. Session IDs are UUIDs (unguessable)
## 🚀 Scalability Considerations

### Current Architecture (Single Server)
Max concurrent users: ~1000 (Vercel limit)

Max sessions: Limited by memory (~100 sessions)

State: In-memory (lost on restart)

Scaling: Manual vertical scaling

### Future Architecture (Distributed)

```
┌─────────────────┐  ┌─────────────────┐
│  WebSocket      │  │  WebSocket      │
│  Server 1       │  │  Server 2       │
│  (In-Memory)    │  │  (In-Memory)    │
└────────┬────────┘  └────────┬────────┘
         │                    │
         └────────┬───────────┘
                  │
         ┌────────▼────────┐
         │   Redis         │
         │   (Shared State)│
         └─────────────────┘
```
### When to Scale

When > 100 concurrent sessions

When > 1000 concurrent users

When server memory exceeds 1GB

When need high availability

## 📊 Performance Optimization

### Client-Side Optimizations
Monaco Editor Lazy Loading: Load only when needed

File Tree Virtualization: Render only visible files

Diff Batching: Batch multiple diffs together

Debouncing: Cursor updates debounced (100ms)

ZIP Streaming: Stream large ZIP files

### Server-Side Optimizations
Connection Pooling: Reuse database connections

Broadcast Batching: Batch broadcasts to reduce overhead

Rate Limiting: Prevent abuse

Memory Management: Clear inactive sessions

### Network Optimizations
Compression: Compress WebSocket messages (when needed)

Binary Protocol: Use binary for large payloads (future)

Latency Optimization: Use nearest Vercel region

## 🛠️ Development Workflow

### Local Development

1. Clone repository
2. Install dependencies
3. Copy .env.example → .env.local
4. Start PostgreSQL locally
5. Run migrations
6. Start development server
7. Connect to local WebSocket
### Testing Workflow

1. Run unit tests
2. Run integration tests
3. Run E2E tests
4. Review coverage reports
5. Fix issues
6. Re-run tests
### Deployment Workflow

1. Push to GitHub
2. Vercel auto-deploys preview
3. Test in preview environment
4. Merge to main
5. Vercel deploys to production
6. Monitor logs and errors
## 📝 Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| app/api/websocket/route.ts | WebSocket server |
| lib/websocket/client.ts | WebSocket client |
| lib/db/schema.ts | Database schema |
| lib/collaboration/yjs.ts | yjs integration |
| stores/sessionStore.ts | Session state |
| components/editor/Editor.tsx | Monaco editor |
### Key Environment Variables

| Variable | Purpose |
|----------|---------|
| DATABASE_URL | PostgreSQL connection |
| NEXTAUTH_SECRET | NextAuth secret |
| BLOB_READ_WRITE_TOKEN | Vercel Blob Storage token |
| NEXT_PUBLIC_WS_URL | WebSocket URL |
Next: Read 02-frontend.md for frontend architecture details.
