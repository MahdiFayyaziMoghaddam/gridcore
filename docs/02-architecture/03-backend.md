# GridCore - Backend Architecture

## ðŸ“‹ Overview

The backend is built on **Next.js API routes** with **serverless functions** deployed on Vercel. It consists of REST APIs for data operations and a **WebSocket server** for real-time communication. The backend is designed to be **stateless**, with all state stored in **in-memory** on the WebSocket server and **persistent data** in PostgreSQL and Vercel Blob Storage.

---

## ðŸ—ï¸ Architecture Layers

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ API Layer (Next.js) â”‚
â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚ â”‚ REST APIs â”‚ â”‚ WebSocket â”‚ â”‚ Middleware â”‚ â”‚
â”‚ â”‚ (HTTP) â”‚ â”‚ Server (WS) â”‚ â”‚ (Auth) â”‚ â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Service Layer â”‚
â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚ â”‚ Session â”‚ â”‚ Storage â”‚ â”‚ Auth â”‚ â”‚
â”‚ â”‚ Service â”‚ â”‚ Service â”‚ â”‚ Service â”‚ â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Data Layer â”‚
â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚ â”‚ PostgreSQL â”‚ â”‚ Vercel Blob â”‚ â”‚ In-Memory â”‚ â”‚
â”‚ â”‚ (Drizzle) â”‚ â”‚ Storage â”‚ â”‚ State â”‚ â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

---

## ðŸ”Œ API Routes Structure

### Authentication Routes (`/api/auth/[...nextauth]`)

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const user = await db.select().from(users).where(eq(users.email, credentials.email)).get()
        if (user && bcrypt.compareSync(credentials.password, user.password)) {
          return { id: user.id, name: user.name, email: user.email }
        }
        return null
      }
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      return session
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60 // 24 hours
  },
  pages: {
    signIn: '/login',
    error: '/login'
  }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
Session Routes
GET /api/sessions - List Saved Sessions
typescript
// app/api/sessions/route.ts
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { sessions, userSessions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  const session = await getServerSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userSavedSessions = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.userId, session.user.id))
    .innerJoin(sessions, eq(sessions.id, userSessions.sessionId))

  return Response.json(userSavedSessions)
}
POST /api/sessions - Create New Session
typescript
export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name } = await req.json()

  // Check rate limit
  const userSessionsCount = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.userId, session.user.id))

  if (userSessionsCount.length >= 3) {
    return Response.json({ error: 'Maximum 3 saved sessions allowed' }, { status: 403 })
  }

  // Generate session ID
  const sessionId = crypto.randomUUID()
  const sessionName = name || `new-session-${Math.random().toString(36).substring(2, 8)}`

  // Create in-memory session (will be saved on close)
  const serverState = getServerState()
  serverState.sessions.set(sessionId, {
    id: sessionId,
    name: sessionName,
    ownerId: session.user.id,
    users: new Set([session.user.id]),
    isSaved: false,
    createdAt: new Date()
  })

  return Response.json({ sessionId, name: sessionName })
}
GET /api/sessions/[id] - Load Saved Session
typescript
// app/api/sessions/[id]/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const savedSession = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, params.id))
    .get()

  if (!savedSession) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  // Check if user has access to this session
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

  return Response.json(savedSession)
}
DELETE /api/sessions/[id] - Delete Saved Session
typescript
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

  if (savedSession.ownerId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Delete from database
  await db.delete(sessions).where(eq(sessions.id, params.id))
  await db.delete(userSessions).where(eq(userSessions.sessionId, params.id))

  // Delete from storage
  await deleteFromBlob(`/sessions/${params.id}/codebase.zip`)

  return Response.json({ success: true })
}
POST /api/sessions/[id]/save - Save Session
typescript
// app/api/sessions/[id]/save/route.ts
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { zipFile } = await req.json() // Base64 encoded ZIP

  // Verify owner
  const serverState = getServerState()
  const activeSession = serverState.sessions.get(params.id)
  if (!activeSession || activeSession.ownerId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check saved sessions limit
  const userSavedSessions = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.userId, session.user.id))

  if (userSavedSessions.length >= 3) {
    return Response.json({ error: 'Maximum 3 saved sessions allowed' }, { status: 403 })
  }

  // Upload to blob storage
  const blob = await put(`/sessions/${params.id}/codebase.zip`, Buffer.from(zipFile, 'base64'), {
    contentType: 'application/zip',
    access: 'private'
  })

  // Save to database
  const savedSession = await db.insert(sessions).values({
    id: params.id,
    name: activeSession.name,
    ownerId: session.user.id,
    zipUrl: blob.url,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning()

  await db.insert(userSessions).values({
    userId: session.user.id,
    sessionId: params.id,
    savedAt: new Date()
  })

  // Update in-memory state
  activeSession.isSaved = true
  activeSession.zipUrl = blob.url

  return Response.json({ success: true })
}
ðŸ—„ï¸ Database Schema (Drizzle)
File: lib/db/schema.ts
typescript
import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Users Table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password'), // Hashed, optional for OAuth users
  githubId: varchar('github_id', { length: 255 }).unique(),
  googleId: varchar('google_id', { length: 255 }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// Sessions Table
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerId: uuid('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  zipUrl: text('zip_url'), // URL to Vercel Blob storage
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// User Sessions Junction Table
export const userSessions = pgTable('user_sessions', {
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  sessionId: uuid('session_id')
    .references(() => sessions.id, { onDelete: 'cascade' })
    .notNull(),
  savedAt: timestamp('saved_at').defaultNow().notNull()
})

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(userSessions)
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  owner: one(users, {
    fields: [sessions.ownerId],
    references: [users.id]
  }),
  users: many(userSessions)
}))

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id]
  }),
  session: one(sessions, {
    fields: [userSessions.sessionId],
    references: [sessions.id]
  })
}))
### Database Migrations

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
} satisfies Config
```

### Storage Service (Vercel Blob)

File: `lib/storage/blob.ts`

```typescript
import { put, del, head } from '@vercel/blob'

export interface StorageService {
  upload: (sessionId: string, buffer: Buffer) => Promise<string>
  download: (sessionId: string) => Promise<Buffer>
  delete: (sessionId: string) => Promise<void>
  exists: (sessionId: string) => Promise<boolean>
}
```

class BlobStorageService implements StorageService {
  private getPath(sessionId: string): string {
    return `/sessions/${sessionId}/codebase.zip`
  }

  async upload(sessionId: string, buffer: Buffer): Promise<string> {
    const { url } = await put(this.getPath(sessionId), buffer, {
      contentType: 'application/zip',
      access: 'private'
    })
    return url
  }

  async download(sessionId: string): Promise<Buffer> {
    const path = this.getPath(sessionId)
    const response = await fetch(path)
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async delete(sessionId: string): Promise<void> {
    const path = this.getPath(sessionId)
    await del(path)
  }

  async exists(sessionId: string): Promise<boolean> {
    const path = this.getPath(sessionId)
    const response = await head(path)
    return response !== null
  }
}

export const storageService = new BlobStorageService()
```

### Authentication Middleware

File: `middleware.ts`

```typescript
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Allow public routes
    const publicPaths = ['/login', '/register', '/api/auth']
    if (publicPaths.some(p => path.startsWith(p))) {
      return NextResponse.next()
    }

    // Check if user is authenticated
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Check if user is trying to access a session they don't have access to
    if (path.startsWith('/session/')) {
      // WebSocket handles session access validation
      return NextResponse.next()
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
)

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
    '/api/((?!auth).*)'
  ]
}
```

### Rate Limiting Implementation

File: `lib/rate-limit.ts`

```typescript
import { getServerSession } from 'next-auth'

// In-memory rate limit store (per server instance)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30 // 30 requests per minute
}

export async function rateLimit(req: Request): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession()
  if (!session) {
    return { success: false, error: 'Unauthorized' }
  }

  const userId = session.user.id
  const now = Date.now()
  const record = rateLimitStore.get(userId)

  if (!record || now > record.resetTime) {
    // New window
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs
    })
    return { success: true }
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    return { success: false, error: 'Rate limit exceeded. Please try again later.' }
  }

  record.count++
  rateLimitStore.set(userId, record)
  return { success: true }
}

// Clean up expired records periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60 * 1000) // Clean every minute
```

### Utility Services

#### Session Service (`lib/services/session-service.ts`)

```typescript
import { db } from '@/lib/db'
```
import { sessions, userSessions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { storageService } from '@/lib/storage/blob'

export class SessionService {
  static async getSavedSessions(userId: string) {
    return await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .innerJoin(sessions, eq(sessions.id, userSessions.sessionId))
  }

  static async loadSavedSession(sessionId: string, userId: string) {
    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get()

    if (!session) throw new Error('Session not found')

    const userAccess = await db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.sessionId, sessionId)
      ))
      .get()

    if (!userAccess && session.ownerId !== userId) {
      throw new Error('Unauthorized')
    }

    // Download ZIP from storage
    const zipBuffer = await storageService.download(sessionId)
    return { session, zipBuffer }
  }

  static async saveSession(
    sessionId: string,
    userId: string,
    zipBuffer: Buffer,
    sessionName: string
  ) {
    // Check session limit
    const userSavedSessions = await this.getSavedSessions(userId)
    if (userSavedSessions.length >= 3) {
      throw new Error('Maximum 3 saved sessions allowed')
    }

    // Upload to storage
    const zipUrl = await storageService.upload(sessionId, zipBuffer)

    // Save to database
    const savedSession = await db
      .insert(sessions)
      .values({
        id: sessionId,
        name: sessionName,
        ownerId: userId,
        zipUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning()

    await db.insert(userSessions).values({
      userId,
      sessionId,
      savedAt: new Date()
    })

    return savedSession[0]
  }

  static async deleteSavedSession(sessionId: string, userId: string) {
    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get()

    if (!session) throw new Error('Session not found')
    if (session.ownerId !== userId) throw new Error('Unauthorized')

    await db.delete(sessions).where(eq(sessions.id, sessionId))
    await db.delete(userSessions).where(eq(userSessions.sessionId, sessionId))
    await storageService.delete(sessionId)
}
  }
}
```

#### Error Handling\r\n\r\n##### Global Error Handler\r\n\r\n`	ypescript\r\n// lib/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super(429, 'Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super(401, 'Unauthorized', 'UNAUTHORIZED')
  }
}

export class SessionLimitError extends AppError {
  constructor() {
    super(403, 'Maximum 3 saved sessions allowed', 'SESSION_LIMIT_EXCEEDED')
  }
}

export class FileTooLargeError extends AppError {
  constructor() {
    super(413, 'File size exceeds 50MB limit', 'FILE_TOO_LARGE')
  }
}
##### API Error Handler\r\n\r\n`	ypescript\r\n// lib/api-handler.ts
export function withErrorHandler(handler: Function) {
  return async (req: Request, ...args: any[]) => {
    try {
      return await handler(req, ...args)
    } catch (error) {
      if (error instanceof AppError) {
        return Response.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        )
      }

      console.error('Unhandled error:', error)
      return Response.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
ðŸ“ API Response Types
typescript
### API Response Types

```typescript\r\n// types/api.ts
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export interface SessionResponse {
  id: string
  name: string
  ownerId: string
  zipUrl?: string
  createdAt: string
  updatedAt: string
}

export interface UserResponse {
  id: string
  name: string
  email: string
  createdAt: string
}
```

Next: Read [04-websocket.md](04-websocket.md) for WebSocket architecture details.



























