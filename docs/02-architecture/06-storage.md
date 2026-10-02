# GridCore - Storage Architecture

## 📋 Overview

GridCore uses **Vercel Blob Storage** for storing session codebases as ZIP files. This is a **cloud-based object storage** service that integrates seamlessly with Vercel deployments. All file contents are stored as ZIP files, and the database stores references (URLs) to these files.

---

## 🏗️ Storage Architecture

┌─────────────────────────────────────────────────────────────┐
│ Vercel Blob Storage │
├─────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Root │ │
│ │ ┌──────────────────────────────────────────────┐ │ │
│ │ │ /sessions/ │ │ │
│ │ │ ┌─────────────────────────────────────────┐ │ │ │
│ │ │ │ /{session-id}/ │ │ │ │
│ │ │ │ ├── codebase.zip │ │ │ │
│ │ │ │ └── metadata.json (future) │ │ │ │
│ │ │ └─────────────────────────────────────────┘ │ │ │
│ │ └──────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ • Max file size: 50MB │
│ • Access: Private (via signed URLs or tokens) │
│ • Content Type: application/zip │
│ │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Storage Service Implementation

### File: `lib/storage/blob.ts`

```typescript
import { put, del, head, list } from '@vercel/blob'
import { Buffer } from 'buffer'
```

// ─────────────────────────────────────────────────────────────
// 1. Configuration
// ─────────────────────────────────────────────────────────────

const STORAGE_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  contentType: 'application/zip',
  access: 'private' as const,
  pathPrefix: '/sessions'
}

// ─────────────────────────────────────────────────────────────
// 2. Storage Service Interface
// ─────────────────────────────────────────────────────────────

export interface StorageService {
  upload(sessionId: string, buffer: Buffer): Promise<string>
  download(sessionId: string): Promise<Buffer>
  delete(sessionId: string): Promise<void>
  exists(sessionId: string): Promise<boolean>
  getSize(sessionId: string): Promise<number>
  listAll(): Promise<string[]>
}

// ─────────────────────────────────────────────────────────────
// 3. Vercel Blob Storage Implementation
// ─────────────────────────────────────────────────────────────

class BlobStorageService implements StorageService {
  private getPath(sessionId: string): string {
    return `${STORAGE_CONFIG.pathPrefix}/${sessionId}/codebase.zip`
  }

  // ──── Upload ──────────────────────────────────────────────

  async upload(sessionId: string, buffer: Buffer): Promise<string> {
    try {
      // Validate file size
      if (buffer.length > STORAGE_CONFIG.maxFileSize) {
        throw new Error(`File size exceeds ${STORAGE_CONFIG.maxFileSize / 1024 / 1024}MB limit`)
      }

      const path = this.getPath(sessionId)

      const { url } = await put(path, buffer, {
        contentType: STORAGE_CONFIG.contentType,
        access: STORAGE_CONFIG.access
      })

      return url
    } catch (error) {
      console.error('Error uploading to blob storage:', error)
      throw new Error(`Failed to upload session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ──── Download ────────────────────────────────────────────

  async download(sessionId: string): Promise<Buffer> {
    try {
      const path = this.getPath(sessionId)

      // Check if file exists first
      const exists = await this.exists(sessionId)
      if (!exists) {
        throw new Error(`Session ${sessionId} not found in storage`)
      }

      const response = await fetch(path)
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } catch (error) {
      console.error('Error downloading from blob storage:', error)
      throw new Error(`Failed to download session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ──── Delete ──────────────────────────────────────────────

  async delete(sessionId: string): Promise<void> {
    try {
      const path = this.getPath(sessionId)
      await del(path)
    } catch (error) {
      console.error('Error deleting from blob storage:', error)
      throw new Error(`Failed to delete session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ──── Exists Check ────────────────────────────────────────

  async exists(sessionId: string): Promise<boolean> {
    try {
      const path = this.getPath(sessionId)
      const result = await head(path)
      return result !== null
    } catch (error) {
      return false
    }
  }

  // ──── Get File Size ──────────────────────────────────────

  async getSize(sessionId: string): Promise<number> {
    try {
      const path = this.getPath(sessionId)
      const result = await head(path)
      if (!result) {
        throw new Error(`Session ${sessionId} not found`)
      }
      return result.size
    } catch (error) {
      throw new Error(`Failed to get size for session ${sessionId}`)
    }
  }

  // ──── List All Sessions ──────────────────────────────────

  async listAll(): Promise<string[]> {
    try {
      const result = await list({
        prefix: STORAGE_CONFIG.pathPrefix,
        mode: 'foldered'
      })

      // Extract session IDs from paths
      const sessionIds = result.blobs.map(blob => {
        const parts = blob.pathname.split('/')
        // Path: /sessions/{sessionId}/codebase.zip
        return parts[2] // sessionId
      })

      return sessionIds
    } catch (error) {
      console.error('Error listing blobs:', error)
      return []
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Singleton Export
// ─────────────────────────────────────────────────────────────

export const storageService = new BlobStorageService()

// ─────────────────────────────────────────────────────────────
// 5. Helper Functions
// ─────────────────────────────────────────────────────────────

export async function getSignedUrl(sessionId: string): Promise<string> {
  const path = `/sessions/${sessionId}/codebase.zip`
  const { url } = await put(path, Buffer.from(''), {
    access: 'private'
  })
  return url
}

export async function getSessionStorageInfo(sessionId: string) {
  const exists = await storageService.exists(sessionId)
  if (!exists) {
    return { exists: false }
  }

  const size = await storageService.getSize(sessionId)
  return {
    exists: true,
    size,
    sizeInMB: (size / 1024 / 1024).toFixed(2)
  }
}
```

## 🔄 Storage Flow

### Upload Flow (Save Session)

```typescript
// Client Side
async function saveSession(sessionId: string) {
  // 1. Client creates ZIP of all files
  const zipBuffer = await createZip(files)

  // 2. Validate size
  if (zipBuffer.length > 50 * 1024 * 1024) {
    throw new Error('Session exceeds 50MB limit')
  }

  // 3. Upload to storage via server
  const response = await fetch(`/api/sessions/${sessionId}/save`, {
    method: 'POST',
    body: JSON.stringify({
      zip: zipBuffer.toString('base64')
    })
  })

  return response.json()
}

// Server Side
async function handleSave(sessionId: string, zipBase64: string) {
  const zipBuffer = Buffer.from(zipBase64, 'base64')

  // Validate
  if (zipBuffer.length > 50 * 1024 * 1024) {
    throw new Error('File too large')
  }

  // Upload to storage
  const url = await storageService.upload(sessionId, zipBuffer)

  // Save to database
  await db.insert(sessions).values({
    id: sessionId,
    zipUrl: url
  })

  return { success: true, url }
}
```

### Download Flow (Load Session)

```typescript
// Client Side
async function loadSession(sessionId: string) {
  // 1. Request session from server
  const response = await fetch(`/api/sessions/${sessionId}`)
  const data = await response.json()

  // 2. Server downloads ZIP from storage
  // 3. Server sends ZIP to client
  // 4. Client extracts ZIP and loads files
```

  return data
}

// Server Side
async function handleLoad(sessionId: string) {
  // Check if session exists in database
  const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get()
  if (!session) {
    throw new Error('Session not found')
  }

  // Download from storage
  const zipBuffer = await storageService.download(sessionId)

  // Return to client
  return {
    session,
    zip: zipBuffer.toString('base64')
  }
}
🛠️ Storage Utilities
ZIP Utilities
typescript
// lib/storage/zip.ts
import JSZip from 'jszip'

export interface ZipFile {
  path: string
  content: string | Buffer
  type: 'file' | 'folder'
}

export class ZipService {
  // Create ZIP from file tree
  static async createZip(files: ZipFile[]): Promise<Buffer> {
    const zip = new JSZip()

    for (const file of files) {
      if (file.type === 'file') {
        zip.file(file.path, file.content)
      } else {
        zip.folder(file.path)
      }
    }

    return await zip.generateAsync({ type: 'nodebuffer' })
  }

  // Extract ZIP to file tree
  static async extractZip(zipBuffer: Buffer): Promise<ZipFile[]> {
    const zip = await JSZip.loadAsync(zipBuffer)
    const files: ZipFile[] = []

    for (const [path, entry] of Object.entries(zip.files)) {
      if (!entry.dir) {
        const content = await entry.async('string')
        files.push({
          path,
          content,
          type: 'file'
        })
      } else {
        files.push({
          path,
          content: '',
          type: 'folder'
        })
      }
    }

    return files
  }

  // Validate ZIP size
  static validateSize(buffer: Buffer): boolean {
    const maxSize = 50 * 1024 * 1024 // 50MB
    return buffer.length <= maxSize
  }

  // Get ZIP file count
  static async getFileCount(zipBuffer: Buffer): Promise<number> {
    const zip = await JSZip.loadAsync(zipBuffer)
    return Object.keys(zip.files).length
  }

  // Check if ZIP contains binary files
  static async hasBinaryFiles(zipBuffer: Buffer): Promise<boolean> {
    const zip = await JSZip.loadAsync(zipBuffer)

    for (const [path, entry] of Object.entries(zip.files)) {
      if (!entry.dir) {
        const content = await entry.async('nodebuffer')
        // Check if content contains null bytes (binary)
        if (content.includes(0)) {
          return true
        }
      }
    }

    return false
  }
}
File Tree Utilities
typescript
// lib/storage/file-tree.ts
export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  content?: string
  children?: FileNode[]
}

export class FileTreeService {
  // Build file tree from flat list
  static buildTree(files: { path: string; content: string }[]): FileNode[] {
    const tree: FileNode[] = []
    const map = new Map<string, FileNode>()

    for (const file of files) {
      const parts = file.path.split('/')
      let currentPath = ''

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const isLast = i === parts.length - 1
        const fullPath = currentPath ? `${currentPath}/${part}` : part

        if (!map.has(fullPath)) {
          const node: FileNode = {
            name: part,
            path: fullPath,
            type: isLast ? 'file' : 'folder',
            children: isLast ? undefined : []
          }

          if (!isLast) {
            map.set(fullPath, node)
          }

          // Add to parent
          if (currentPath) {
            const parent = map.get(currentPath)
            if (parent && parent.children) {
              parent.children.push(node)
            }
          } else {
            tree.push(node)
          }
        }

        currentPath = fullPath
      }

      // Set content for file
      const node = map.get(file.path)
      if (node && node.type === 'file') {
        node.content = file.content
      }
    }

    return tree
  }

  // Flatten file tree
  static flattenTree(nodes: FileNode[]): { path: string; content: string }[] {
    const result: { path: string; content: string }[] = []

    const traverse = (node: FileNode) => {
      if (node.type === 'file' && node.content !== undefined) {
        result.push({
          path: node.path,
          content: node.content
        })
      }

      if (node.children) {
        for (const child of node.children) {
          traverse(child)
        }
      }
    }

    for (const node of nodes) {
      traverse(node)
    }

    return result
  }

  // Sort file tree (folders first, then files alphabetically)
  static sortTree(nodes: FileNode[]): FileNode[] {
    const sorted = [...nodes]

    sorted.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1
      if (a.type === 'file' && b.type === 'folder') return 1
      return a.name.localeCompare(b.name)
    })

    for (const node of sorted) {
      if (node.children) {
        node.children = this.sortTree(node.children)
      }
    }

    return sorted
  }
}
🔒 Security
Access Control
typescript
// lib/storage/security.ts
export class StorageSecurity {
  // Validate session ownership before storage operations
  static async validateAccess(
    sessionId: string,
    userId: string,
    db: any
  ): Promise<boolean> {
    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get()

    if (!session) return false
    return session.ownerId === userId
  }

  // Generate secure path
  static getSecurePath(sessionId: string): string {
    // Use UUID and prefix to prevent path traversal
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      throw new Error('Invalid session ID format')
    }

    return `/sessions/${sessionId}/codebase.zip`
  }
}
File Validation
typescript
// lib/storage/validation.ts
export class FileValidation {
  static validateFileName(name: string): boolean {
    // Prevent path traversal
    if (name.includes('..')) return false
    if (name.includes('/') || name.includes('\\')) return false
    return true
  }

  static validateFilePath(path: string): boolean {
    // Prevent path traversal
    if (path.includes('..')) return false
    // Must be relative path
    if (path.startsWith('/')) return false
    return true
  }

  static validateFileContent(content: string): boolean {
    // Max file size for individual file (10MB)
    if (content.length > 10 * 1024 * 1024) return false

    // Check for null bytes (binary content)
    if (content.includes('\0')) return false

    return true
  }
}
📊 Monitoring
Storage Metrics
typescript
// lib/storage/metrics.ts
export interface StorageMetrics {
  totalSessions: number
  totalStorageUsed: number
  averageSize: number
  largestSession: string
  oldestSession: string
}

export class StorageMonitor {
  static async getMetrics(): Promise<StorageMetrics> {
    const sessionIds = await storageService.listAll()

    let totalSize = 0
    let largestSize = 0
    let largestSession = ''

    for (const id of sessionIds) {
      const size = await storageService.getSize(id)
      totalSize += size

      if (size > largestSize) {
        largestSize = size
        largestSession = id
      }
    }

    return {
      totalSessions: sessionIds.length,
      totalStorageUsed: totalSize,
      averageSize: sessionIds.length > 0 ? totalSize / sessionIds.length : 0,
      largestSession,
      oldestSession: sessionIds[0] || ''
    }
  }

  static async logMetrics() {
    const metrics = await this.getMetrics()
    console.log('📊 Storage Metrics:', {
      sessions: metrics.totalSessions,
      totalStorage: (metrics.totalStorageUsed / 1024 / 1024).toFixed(2) + 'MB',
      averageSize: (metrics.averageSize / 1024 / 1024).toFixed(2) + 'MB',
      largestSession: metrics.largestSession
    })
  }
}
🧹 Cleanup
Storage Cleanup
typescript
// scripts/cleanup-storage.ts
import { storageService } from '@/lib/storage/blob'
import { db } from '@/lib/db'
import { sessions } from '@/lib/db/schema'

async function cleanupStorage() {
  console.log('🧹 Cleaning up storage...')

  // Get all session IDs from storage
  const storedSessions = await storageService.listAll()

  // Get all session IDs from database
  const dbSessions = await db.select({ id: sessions.id }).from(sessions)
  const dbSessionIds = new Set(dbSessions.map(s => s.id))

  // Find orphaned sessions (in storage but not in database)
  const orphaned = storedSessions.filter(id => !dbSessionIds.has(id))

  console.log(`Found ${orphaned.length} orphaned sessions`)

  // Delete orphaned sessions
  for (const sessionId of orphaned) {
    console.log(`Deleting orphaned session: ${sessionId}`)
    await storageService.delete(sessionId)
  }

  console.log('✅ Cleanup completed')
}

cleanupStorage().catch(console.error)
📝 Environment Variables
env
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_blob_token

# Optional: Storage region
BLOB_STORAGE_REGION=auto
🚀 Deployment
Vercel Configuration
json
// vercel.json
{
  "functions": {
    "api/storage/**/*.ts": {
      "maxDuration": 10,
      "memory": 1024
    }
  }
}
Environment Setup
bash
# Set up Vercel Blob Storage
vercel blob create

# Configure environment variables
vercel env add BLOB_READ_WRITE_TOKEN

# Deploy
vercel deploy --prod
📊 Storage Limits
Limit	Value	Notes
Max file size	50MB	Per ZIP file
Total storage	10GB	Free tier (Vercel Blob)
Upload timeout	30s	Vercel function limit
Download timeout	30s	Vercel function limit
Concurrent uploads	10	Per project
Next: Proceed to 03-features/01-authentication.md for feature implementation details.

text

Now let's move to the features section. I'll generate the authentication feature first.

# 03-features/01-authentication.md

```markdown
# GridCore - Authentication Feature

## 📋 Overview

Authentication in GridCore is handled by **NextAuth.js** (v4) with support for **email/password**, **GitHub OAuth**, and **Google OAuth**. The authentication system provides JWT-based sessions, user management, and authorization for all protected routes.

---

## 🔐 Authentication Flow
┌─────────────────────────────────────────────────────────────┐
│ Authentication Flow │
├─────────────────────────────────────────────────────────────┤
│ │
│ User → Login Page → Submit Credentials │
│ │ │
│ ▼ │
│ NextAuth → Validate Credentials │
│ │ │
│ ├── Email/Password → bcrypt verify │
│ ├── GitHub → OAuth callback │
│ └── Google → OAuth callback │
│ │ │
│ ▼ │
│ Create JWT Session → Store in Cookie │
│ │ │
│ ▼ │
│ User → Dashboard (authenticated) │
│ │
└─────────────────────────────────────────────────────────────┘

text

---

## 🗄️ User Schema

### Database Schema

```typescript
// lib/db/schema.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password'), // Hashed with bcrypt
  githubId: varchar('github_id', { length: 255 }).unique(),
  googleId: varchar('google_id', { length: 255 }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})
🔌 NextAuth Configuration
File: app/api/auth/[...nextauth]/route.ts
typescript
import NextAuth from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'

// ─────────────────────────────────────────────────────────────
// 1. Auth Configuration
// ─────────────────────────────────────────────────────────────

export const authOptions = {
  // ──── Providers ──────────────────────────────────────────

  providers: [
    // Email/Password Provider
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'email@example.com' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing credentials')
        }

        // Find user by email
        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email))
          .get()

        if (!user) {
          throw new Error('No user found with this email')
        }

        // Check if user has password (OAuth users may not)
        if (!user.password) {
          throw new Error('Please log in with your OAuth provider')
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          throw new Error('Invalid password')
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email
        }
      }
    }),

    // GitHub OAuth Provider
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          githubId: profile.id.toString()
        }
      }
    }),

    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          googleId: profile.sub
        }
      }
    })
  ],

  // ──── Callbacks ──────────────────────────────────────────

  callbacks: {
    // JWT callback - add user ID to token
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
      }

      // Handle OAuth sign in
      if (account && user) {
        // Create or update user in database
        await handleOAuthUser(account.provider, user, account)
      }

      return token
    },

    // Session callback - add user ID to session
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
      }
      return session
    },

    // Sign in callback
    async signIn({ user, account, profile }) {
      if (account?.provider === 'credentials') {
        return true
      }

      // OAuth users - allow sign in
      return true
    }
  },

  // ──── Session Configuration ─────────────────────────────

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60 // 24 hours
  },

  // ──── Pages ──────────────────────────────────────────────

  pages: {
    signIn: '/login',
    error: '/login',
    newUser: '/register'
  },

  // ──── Security ───────────────────────────────────────────

  secret: process.env.NEXTAUTH_SECRET
}

// ─────────────────────────────────────────────────────────────
// 2. OAuth User Handler
// ─────────────────────────────────────────────────────────────

async function handleOAuthUser(provider: string, user: any, account: any) {
  // Check if user exists by provider ID
  let existingUser

  if (provider === 'github') {
    existingUser = await db
      .select()
      .from(users)
      .where(eq(users.githubId, account.providerAccountId))
      .get()
  } else if (provider === 'google') {
    existingUser = await db
      .select()
      .from(users)
      .where(eq(users.googleId, account.providerAccountId))
      .get()
  }

  if (existingUser) {
    // Update user if needed
    if (existingUser.name !== user.name) {
      await db
        .update(users)
        .set({ name: user.name })
        .where(eq(users.id, existingUser.id))
    }
    return
  }

  // Check if email already exists
  const userByEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, user.email))
    .get()

  if (userByEmail) {
    // Link OAuth account to existing user
    const updateData = provider === 'github'
      ? { githubId: account.providerAccountId }
      : { googleId: account.providerAccountId }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userByEmail.id))
    return
  }

  // Create new user
  const createData = {
    id: user.id,
    name: user.name,
    email: user.email,
    ...(provider === 'github' ? { githubId: account.providerAccountId } : {}),
    ...(provider === 'google' ? { googleId: account.providerAccountId } : {})
  }

  await db.insert(users).values(createData)
}

// ─────────────────────────────────────────────────────────────
// 3. Export Handler
// ─────────────────────────────────────────────────────────────

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
🔐 Password Hashing
File: lib/auth/password.ts
typescript
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }

  if (password.length > 100) {
    errors.push('Password must be less than 100 characters')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
📝 Register Page
File: app/(auth)/register/page.tsx
typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    // Validate password strength
    const { valid, errors } = validatePassword(formData.password)
    if (!valid) {
      setError(errors.join('. '))
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Registration failed')
      }

      // Sign in after registration
      await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = (provider: 'github' | 'google') => {
    signIn(provider, { callbackUrl: '/dashboard' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                {error}
              </Alert>
            )}

            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="********"
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Confirm Password</label>
              <Input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="********"
                required
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOAuthSignIn('github')}
                disabled={isLoading}
              >
                GitHub
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOAuthSignIn('google')}
                disabled={isLoading}
              >
                Google
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <a href="/login" className="text-primary hover:underline">
                Sign in
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
🔑 Login Page
File: app/(auth)/login/page.tsx
typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      if (result?.error) {
        throw new Error(result.error)
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = (provider: 'github' | 'google') => {
    signIn(provider, { callbackUrl: '/dashboard' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                {error}
              </Alert>
            )}

            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="********"
                required
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOAuthSignIn('github')}
                disabled={isLoading}
              >
                GitHub
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOAuthSignIn('google')}
                disabled={isLoading}
              >
                Google
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <a href="/register" className="text-primary hover:underline">
                Create one
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
🛡️ Middleware
File: middleware.ts
typescript
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Allow public routes
    const publicPaths = [
      '/login',
      '/register',
      '/api/auth',
      '/_next',
      '/favicon.ico'
    ]

    if (publicPaths.some(p => path.startsWith(p))) {
      return NextResponse.next()
    }

    // Check if user is authenticated
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
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
🔐 Registration API
File: app/api/auth/register/route.ts
typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword, validatePassword } from '@/lib/auth/password'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Validate password
    const { valid, errors } = validatePassword(password)
    if (!valid) {
      return NextResponse.json(
        { error: errors.join('. ') },
        { status: 400 }
      )
    }

    // Check if email is already registered
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get()

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword
      })
      .returning()

    return NextResponse.json({
      success: true,
      user: {
        id: newUser[0].id,
        name: newUser[0].name,
        email: newUser[0].email
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
📋 Environment Variables
env
# NextAuth
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000

# GitHub OAuth
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

**This concludes the storage. Proceed to [03-features/01-authentication.md](../03-features/01-authentication.md) for the features overview.**
````
