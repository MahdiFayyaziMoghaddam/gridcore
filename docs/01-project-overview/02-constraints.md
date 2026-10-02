# GridCore - Project Constraints & Limits

## 📋 Overview

This document outlines all **non-negotiable constraints, limits, and rules** that must be strictly followed in the GridCore project. These constraints define the boundaries of the system and ensure consistency, security, and scalability.

---

## ⚡ System Limits

### Session Limits
| Constraint | Value | Notes |
|------------|-------|-------|
| **Max users per session** | 20 | Hard limit, cannot be exceeded |
| **Max saved sessions per user** | 3 | User cannot save more than 3 sessions |
| **Max session ID length** | 36 | UUID format (e.g., 123e4567-e89b-12d3-a456-426614174000) |
| **Session inactivity timeout** | None | Sessions persist while owner/temp owner is online |
| **Session name max length** | 50 | Optional name set by owner |

### File & Storage Limits
| Constraint | Value | Notes |
|------------|-------|-------|
| **Max ZIP file size** | 50MB | For import, export, and save operations |
| **Max individual file size** | None | Limited by total ZIP size (50MB) |
| **Max file path length** | 255 | Standard filesystem limit |
| **Max nested folders** | None | No artificial depth limit |
| **Supported file types** | All text formats | Binary files are not supported |

### Chat Limits
| Constraint | Value | Notes |
|------------|-------|-------|
| **Max message length** | 200 characters | Per message |
| **Message cooldown** | 10 seconds | Per user, per session |
| **Chat persistence** | None | Chat is not saved in database |
| **Max chat history** | 100 messages | In-memory only, per session |

### Rate Limits
| Constraint | Value | Notes |
|------------|-------|-------|
| **Database operations** | 30 requests/minute | Per user, all database operations |
| **Authentication attempts** | 5 attempts/minute | Per IP address |
| **Session creation** | 5 sessions/minute | Per user |
| **File operations** | 20 operations/minute | Per user |

---

## 🛡️ Security Constraints

### Authentication
1. **All users must be authenticated** for all operations
2. **Email/password authentication** with secure hashing (bcrypt)
3. **OAuth providers**: GitHub and Google
4. **Session tokens** are managed by NextAuth.js
5. **JWT tokens** expire after 24 hours

### Session Security
1. **Session IDs are UUID v4** (random, unguessable)
2. **Session IDs can be changed by the owner** (old ID breaks immediately)
3. **No public session discovery** - users must have the session ID
4. **No session password** - access is controlled by session ID

### Data Protection
1. **All passwords** are hashed with bcrypt
2. **All database connections** use SSL/TLS
3. **All WebSocket connections** use WSS in production
4. **No sensitive data** is stored in client-side storage

### Access Control
1. **Owners** have full control (save, export, change ID, grant temp ownership)
2. **Temp owners** can create/delete files only
3. **Regular users** can only edit files
4. **Users cannot join a session** if the owner is offline (unless temp owner is online)

---

## 🏗️ Technical Constraints

### Architecture Constraints
1. **Client-centric**: Server does not store file contents in memory
2. **Stateless server**: All state is in-memory (can be lost on restart)
3. **No Redis**: Initial version uses only in-memory storage
4. **No Git**: No direct Git integration (import/export only ZIP)

### Code Constraints
1. **Framework**: Next.js 14 (App Router)
2. **Language**: TypeScript (strict mode enabled)
3. **Database**: PostgreSQL with Drizzle ORM
4. **State management**: Zustand for client state
5. **UI library**: Shadcn + Tailwind CSS
6. **Code editor**: Monaco Editor

### Browser Constraints
1. **Supported browsers**: Chrome, Firefox, Safari, Edge (latest 2 versions)
2. **JavaScript required**: No fallback for disabled JS
3. **WebSocket support**: Required for real-time features
4. **Local storage**: Used for session persistence

---

## 🔄 Process Constraints

### Session Lifecycle Constraints
1. **Sessions start** only when the owner is online
2. **Sessions live** while owner OR temp owner is online
3. **Sessions end** when the last owner (main or temp) disconnects
4. **Sessions save** only on close (if owner chooses) or manual save
5. **Unsaved sessions** are lost on server restart or owner disconnect

### Ownership Constraints
1. **Only the main owner** can save, export, and change session ID
2. **Temp owners** must be granted by the main owner
3. **Temp owners** can create/delete files
4. **Ownership cannot be transferred** permanently (only temporary)
5. **Main owner reclaims ownership** automatically upon reconnection

### File Operations Constraints
1. **Only owners and temp owners** can create/delete files
2. **Regular users** can only edit existing files
3. **File operations** are broadcasted to all users
4. **File conflicts**: Last-write-wins for same line edits

### Multiple Tabs Constraints
1. **Users cannot open the app in multiple tabs** simultaneously
2. **Detection method**: LocalStorage + WebSocket connection check
3. **Blocking method**: Show message "You already have GridCore open"
4. **Exception**: User can open in a new tab after closing the old one

---

## 📊 Performance Constraints

### Response Time Requirements
| Operation | Max Time | Notes |
|-----------|----------|-------|
| Session creation | < 1 second | Authentication + session setup |
| Joining a session | < 3 seconds | Including codebase transfer |
| File save operation | < 500ms | Diff application |
| Cursor update | < 100ms | WebSocket broadcast |
| Chat message | < 200ms | Send + broadcast |
| ZIP upload | < 10 seconds | For 50MB file |
| ZIP download | < 10 seconds | For 50MB file |

### Memory Constraints
| Resource | Limit | Notes |
|----------|-------|-------|
| Per session memory | ~50MB | Codebase in memory on clients |
| Server memory usage | ~1GB | For all sessions combined (Vercel limit) |
| Client memory usage | ~200MB | Editor + file tree + state |

### Network Constraints
| Resource | Limit | Notes |
|----------|-------|-------|
| WebSocket message size | 1MB | Per message payload |
| WebSocket messages/second | 100 | Per session (rate limited) |
| Concurrent WebSocket connections | 1000 | Server limit |

---

## 🎨 UI/UX Constraints

### Layout Constraints
1. **Dark theme only**: No light theme support initially
2. **Minimal design**: Clean and uncluttered interface
3. **Responsive**: Desktop-first, but works on tablets
4. **Layout**: Sidebar + Navbar + Main content area

### Navigation Constraints
1. **Single app layout**: All features in one layout (like VSCode)
2. **Sidebar tabs**: Files, Chat, Users
3. **Separate pages**: Login, Register, Dashboard (saved sessions)
4. **Join session**: Separate page or modal

### Accessibility Constraints
1. **Minimum contrast ratio**: 4.5:1 (WCAG AA)
2. **Keyboard navigation**: All features accessible via keyboard
3. **Screen reader support**: ARIA labels for all interactive elements
4. **Focus indicators**: Visible focus states

---

## 🧪 Testing Constraints

### Testing Requirements
1. **Unit tests**: All utilities and components
2. **Integration tests**: WebSocket and API routes
3. **E2E tests**: Critical user flows (login, create session, edit files)
4. **Test coverage**: Minimum 70%

### Testing Environments
1. **Development**: Local environment with test database
2. **Staging**: Vercel preview deployments
3. **Production**: Vercel production deployments

---

## 📦 Deployment Constraints

### Vercel Constraints
1. **Use Vercel Edge Runtime** for WebSocket server
2. **Serverless functions** for API routes
3. **Vercel Blob Storage** for ZIP files
4. **Environment variables** managed via Vercel dashboard

### Database Constraints
1. **PostgreSQL** as the primary database
2. **Drizzle ORM** for type-safe queries
3. **Migrations** managed via Drizzle
4. **Connection pooling** enabled

### Storage Constraints
1. **Vercel Blob Storage** for ZIP files
2. **Path format**: `/sessions/{sessionId}/codebase.zip`
3. **Max file size**: 50MB
4. **Public access**: Files are private (not publicly accessible)

---

## 🔍 Monitoring Constraints

### Logging Requirements
1. **Vercel logs** for server-side logging
2. **Console logs** for development
3. **Error tracking**: TODO (Sentry/Logtail/Better Stack)
4. **No sensitive data** in logs

### Analytics Requirements
1. **Basic usage metrics**: Session creation, user count, etc.
2. **No user tracking**: Privacy-first approach
3. **Performance monitoring**: Vercel Analytics

---

## 📝 Validation Checklist

### Before Deployment
- [ ] All rate limits are enforced
- [ ] Session limits (20 users, 3 saved) are enforced
- [ ] File size limit (50MB) is enforced
- [ ] Chat limits (200 chars, 10s cooldown) are enforced
- [ ] Multiple tabs are blocked
- [ ] Only owners can save/export/change ID
- [ ] Session ID changes break old ID immediately
- [ ] Unsaved sessions warn before closing
- [ ] All environment variables are set
- [ ] Database migrations are applied
- [ ] Storage bucket is configured

---

## 🆘 Troubleshooting Common Constraint Issues

### "Cannot save more than 3 sessions"
**Solution**: User must delete an existing saved session before saving a new one.

### "Session is full (20 users)"
**Solution**: Users cannot join until someone leaves.

### "File is too large (>50MB)"
**Solution**: Owner must reduce the codebase size before importing/saving.

### "You already have GridCore open"
**Solution**: Close the existing tab or use a different browser.

### "Rate limit exceeded"
**Solution**: Wait for the rate limit window to reset (1 minute).

---

**Next**: Read [03-glossary.md](03-glossary.md) for definitions of key terms.