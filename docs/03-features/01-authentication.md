# GridCore - Authentication Feature

## 📋 Overview

Authentication in GridCore is handled by **NextAuth.js** (v4) with support for **email/password**, **GitHub OAuth**, and **Google OAuth**. The authentication system provides JWT-based sessions, user management, and authorization for all protected routes.

---

## 🔐 Authentication Flow

```
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
```

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
```
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
Next: Read 02-sessions.md for session management implementation.

text

---

Now continuing with the remaining feature files. Let me generate `04-file-management.md`:

# 03-features/04-file-management.md

```markdown
# GridCore - File Management

## 📋 Overview

File management in GridCore handles the creation, deletion, renaming, and organization of files and folders within a session. The file system is **client-centric**, with all operations synchronized via yjs and broadcasted through the WebSocket server.

---

## 🏗️ File System Architecture
┌─────────────────────────────────────────────────────────────────────────┐
│ File System Architecture │
├─────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Client A │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ File Tree │ │ yjs Text │ │ Monaco │ │ │
│ │ │ (Zustand) │──│ (CRDT) │──│ Editor │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │ │
│ ▼ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ WebSocket Server │ │
│ │ ┌────────────────────────────────────────────────────────────┐│ │
│ │ │ Broadcast Engine ││ │
│ │ └────────────────────────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │ │
│ ▼ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Client B │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ File Tree │ │ yjs Text │ │ Monaco │ │ │
│ │ │ (Zustand) │──│ (CRDT) │──│ Editor │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────┘

text

---

## 📂 File Tree Data Structure

### File: `types/file.ts`

```typescript
export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  content?: string
  children?: FileNode[]
  extension?: string
  size?: number
}

export interface FileTree {
  root: FileNode[]
  files: Map<string, string> // path → content
  openFiles: string[] // paths
  activeFile: string | null // path
}

export interface FileOperation {
  type: 'create' | 'delete' | 'rename' | 'move'
  path: string
  newPath?: string
  content?: string
  userId: string
  timestamp: number
}
📦 File Store (Zustand)
File: stores/fileStore.ts
typescript
import { create } from 'zustand'
import { FileNode, FileTree } from '@/types/file'

interface FileStore {
  // State
  files: FileNode[]
  fileContents: Map<string, string>
  openFiles: string[]
  activeFile: string | null

  // Actions
  loadFiles: (files: FileNode[]) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  createFile: (path: string, content?: string) => void
  createFolder: (path: string) => void
  deleteFile: (path: string) => void
  renameFile: (oldPath: string, newPath: string) => void
  moveFile: (oldPath: string, newPath: string) => void
  getFileContent: (path: string) => string | null
  getFileNode: (path: string) => FileNode | null
  getAllFiles: () => { path: string; content: string }[]
}

export const useFileStore = create<FileStore>((set, get) => ({
  // ──── Initial State ──────────────────────────────────────

  files: [],
  fileContents: new Map(),
  openFiles: [],
  activeFile: null,

  // ──── Load Files ─────────────────────────────────────────

  loadFiles: (files: FileNode[]) => {
    // Flatten file tree to get all file contents
    const contents = new Map<string, string>()
    const flatten = (nodes: FileNode[], prefix: string = '') => {
      for (const node of nodes) {
        const fullPath = prefix ? `${prefix}/${node.name}` : node.name
        if (node.type === 'file' && node.content !== undefined) {
          contents.set(fullPath, node.content)
        }
        if (node.children) {
          flatten(node.children, fullPath)
        }
      }
    }
    flatten(files)

    set({ files, fileContents: contents })
  },

  // ──── File Operations ────────────────────────────────────

  openFile: (path: string) => {
    const { openFiles } = get()
    if (!openFiles.includes(path)) {
      set({ openFiles: [...openFiles, path] })
    }
    set({ activeFile: path })
  },

  closeFile: (path: string) => {
    const { openFiles, activeFile } = get()
    const newOpenFiles = openFiles.filter(p => p !== path)
    const newActiveFile = activeFile === path
      ? newOpenFiles[newOpenFiles.length - 1] || null
      : activeFile
    set({ openFiles: newOpenFiles, activeFile: newActiveFile })
  },

  setActiveFile: (path: string) => {
    set({ activeFile: path })
  },

  updateFileContent: (path: string, content: string) => {
    const { fileContents } = get()
    const newContents = new Map(fileContents)
    newContents.set(path, content)
    set({ fileContents: newContents })
  },

  // ──── File Tree Operations ──────────────────────────────

  createFile: (path: string, content: string = '') => {
    const { files, fileContents } = get()

    // Parse path
    const parts = path.split('/')
    const fileName = parts.pop()!
    const folderPath = parts.join('/')

    // Create file node
    const newNode: FileNode = {
      name: fileName,
      path,
      type: 'file',
      content
    }

    // Add to file tree
    const newFiles = addNodeToTree(files, folderPath, newNode)

    // Update contents
    const newContents = new Map(fileContents)
    newContents.set(path, content)

    set({ files: newFiles, fileContents: newContents })
  },

  createFolder: (path: string) => {
    const { files } = get()

    // Parse path
    const parts = path.split('/')
    const folderName = parts.pop()!
    const parentPath = parts.join('/')

    // Create folder node
    const newNode: FileNode = {
      name: folderName,
      path,
      type: 'folder',
      children: []
    }

    // Add to file tree
    const newFiles = addNodeToTree(files, parentPath, newNode)

    set({ files: newFiles })
  },

  deleteFile: (path: string) => {
    const { files, fileContents, openFiles, activeFile } = get()

    // Remove from file tree
    const newFiles = removeNodeFromTree(files, path)

    // Remove from contents
    const newContents = new Map(fileContents)
    newContents.delete(path)

    // Remove from open files
    const newOpenFiles = openFiles.filter(p => p !== path)
    const newActiveFile = activeFile === path
      ? newOpenFiles[newOpenFiles.length - 1] || null
      : activeFile

    set({
      files: newFiles,
      fileContents: newContents,
      openFiles: newOpenFiles,
      activeFile: newActiveFile
    })
  },

  renameFile: (oldPath: string, newPath: string) => {
    const { files, fileContents, openFiles, activeFile } = get()

    // Rename in file tree
    const newFiles = renameNodeInTree(files, oldPath, newPath)

    // Rename in contents
    const newContents = new Map(fileContents)
    const content = fileContents.get(oldPath)
    if (content !== undefined) {
      newContents.delete(oldPath)
      newContents.set(newPath, content)
    }

    // Rename in open files
    const newOpenFiles = openFiles.map(p => p === oldPath ? newPath : p)
    const newActiveFile = activeFile === oldPath ? newPath : activeFile

    set({
      files: newFiles,
      fileContents: newContents,
      openFiles: newOpenFiles,
      activeFile: newActiveFile
    })
  },

  moveFile: (oldPath: string, newPath: string) => {
    // Similar to rename but with different path
    // Implementation uses the same logic as rename
    const { renameFile } = get()
    renameFile(oldPath, newPath)
  },

  // ──── Getters ─────────────────────────────────────────────

  getFileContent: (path: string) => {
    const { fileContents } = get()
    return fileContents.get(path) || null
  },

  getFileNode: (path: string) => {
    const { files } = get()
    return findNodeInTree(files, path)
  },

  getAllFiles: () => {
    const { fileContents } = get()
    const result: { path: string; content: string }[] = []
    for (const [path, content] of fileContents) {
      result.push({ path, content })
    }
    return result
  }
}))

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function addNodeToTree(
  nodes: FileNode[],
  parentPath: string,
  newNode: FileNode
): FileNode[] {
  if (!parentPath) {
    return [...nodes, newNode]
  }

  return nodes.map(node => {
    if (node.path === parentPath && node.type === 'folder') {
      return {
        ...node,
        children: addNodeToTree(node.children || [], '', newNode)
      }
    }
    if (node.children) {
      return {
        ...node,
        children: addNodeToTree(node.children, parentPath, newNode)
      }
    }
    return node
  })
}

function removeNodeFromTree(nodes: FileNode[], path: string): FileNode[] {
  return nodes
    .filter(node => node.path !== path)
    .map(node => {
      if (node.children) {
        return {
          ...node,
          children: removeNodeFromTree(node.children, path)
        }
      }
      return node
    })
}

function renameNodeInTree(
  nodes: FileNode[],
  oldPath: string,
  newPath: string
): FileNode[] {
  return nodes.map(node => {
    if (node.path === oldPath) {
      return {
        ...node,
        path: newPath,
        name: newPath.split('/').pop() || node.name
      }
    }
    if (node.children) {
      return {
        ...node,
        children: renameNodeInTree(node.children, oldPath, newPath)
      }
    }
    return node
  })
}

function findNodeInTree(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node
    }
    if (node.children) {
      const found = findNodeInTree(node.children, path)
      if (found) return found
    }
  }
  return null
}
📁 File Explorer Component
File: components/editor/FileTree.tsx
typescript
'use client'

import { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder, Plus, Trash2, Pencil, FolderPlus } from 'lucide-react'
import { useFileStore } from '@/stores/fileStore'
import { FileNode } from '@/types/file'

interface FileTreeProps {
  onFileClick: (path: string) => void
  onFileCreate: (path: string, content?: string) => void
  onFileDelete: (path: string) => void
  onFileRename: (oldPath: string, newPath: string) => void
  onFolderCreate: (path: string) => void
}

export function FileTree({
  onFileClick,
  onFileCreate,
  onFileDelete,
  onFileRename,
  onFolderCreate
}: FileTreeProps) {
  const { files, activeFile } = useFileStore()
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null)
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [newFileName, setNewFileName] = useState('')

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, path })
  }

  const handleRename = (oldPath: string) => {
    setEditingPath(oldPath)
    setNewFileName(oldPath.split('/').pop() || '')
    setContextMenu(null)
  }

  const handleRenameSubmit = (oldPath: string) => {
    if (newFileName.trim()) {
      const parts = oldPath.split('/')
      parts.pop()
      const newPath = parts.length > 0 ? `${parts.join('/')}/${newFileName}` : newFileName
      if (newPath !== oldPath) {
        onFileRename(oldPath, newPath)
      }
    }
    setEditingPath(null)
    setNewFileName('')
  }

  const renderTree = (nodes: FileNode[], depth: number = 0, parentPath: string = '') => {
    // Sort: folders first, then files
    const sorted = [...nodes].sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1
      if (a.type === 'file' && b.type === 'folder') return 1
      return a.name.localeCompare(b.name)
    })

    return sorted.map((node) => {
      const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name
      const isExpanded = expandedFolders.has(fullPath)
      const isActive = fullPath === activeFile

      if (node.type === 'folder') {
        return (
          <div key={fullPath} style={{ paddingLeft: `${depth * 16}px` }}>
            <div
              className="flex items-center gap-1 py-1 px-2 hover:bg-surface-hover rounded cursor-pointer group"
              onClick={() => toggleFolder(fullPath)}
              onContextMenu={(e) => handleContextMenu(e, fullPath)}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Folder size={16} className="text-yellow-500" />
              {editingPath === fullPath ? (
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onBlur={() => handleRenameSubmit(fullPath)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit(fullPath)
                    if (e.key === 'Escape') setEditingPath(null)
                  }}
                  className="bg-surface border border-border rounded px-1 py-0 text-sm"
                  autoFocus
                />
              ) : (
                <span className="text-sm">{node.name}</span>
              )}
              <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const newPath = fullPath ? `${fullPath}/new-file` : 'new-file'
                    onFileCreate(newPath, '')
                  }}
                  className="p-1 hover:bg-surface-hover rounded"
                  title="New File"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const newPath = fullPath ? `${fullPath}/new-folder` : 'new-folder'
                    onFolderCreate(newPath)
                  }}
                  className="p-1 hover:bg-surface-hover rounded"
                  title="New Folder"
                >
                  <FolderPlus size={12} />
                </button>
              </div>
            </div>
            {isExpanded && node.children && (
              <div>
                {renderTree(node.children, depth + 1, fullPath)}
              </div>
            )}
          </div>
        )
      }

      return (
        <div
          key={fullPath}
          style={{ paddingLeft: `${depth * 16 + 16}px` }}
          className={`flex items-center gap-1 py-1 px-2 hover:bg-surface-hover rounded cursor-pointer group ${
            isActive ? 'bg-surface-hover' : ''
          }`}
          onClick={() => onFileClick(fullPath)}
          onContextMenu={(e) => handleContextMenu(e, fullPath)}
        >
          <FileIcon extension={node.extension || getFileExtension(node.name)} />
          {editingPath === fullPath ? (
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onBlur={() => handleRenameSubmit(fullPath)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit(fullPath)
                if (e.key === 'Escape') setEditingPath(null)
              }}
              className="bg-surface border border-border rounded px-1 py-0 text-sm"
              autoFocus
            />
          ) : (
            <span className="text-sm">{node.name}</span>
          )}
          <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRename(fullPath)
              }}
              className="p-1 hover:bg-surface-hover rounded"
              title="Rename"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onFileDelete(fullPath)
              }}
              className="p-1 hover:bg-surface-hover rounded text-red-500"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )
    })
  }

  return (
    <div className="file-tree p-2">
      <div className="mb-2 flex justify-between items-center">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Explorer</span>
        <div className="flex gap-1">
          <button
            onClick={() => onFileCreate('new-file', '')}
            className="p-1 hover:bg-surface-hover rounded"
            title="New File"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => onFolderCreate('new-folder')}
            className="p-1 hover:bg-surface-hover rounded"
            title="New Folder"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>
      <div className="space-y-0.5">
        {renderTree(files)}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={contextMenu.path}
          onClose={() => setContextMenu(null)}
          onRename={() => handleRename(contextMenu.path)}
          onDelete={() => {
            onFileDelete(contextMenu.path)
            setContextMenu(null)
          }}
          onCreateFile={() => {
            const parentPath = contextMenu.path.includes('/')
              ? contextMenu.path.substring(0, contextMenu.path.lastIndexOf('/'))
              : ''
            const newPath = parentPath ? `${parentPath}/new-file` : 'new-file'
            onFileCreate(newPath, '')
            setContextMenu(null)
          }}
          onCreateFolder={() => {
            const parentPath = contextMenu.path.includes('/')
              ? contextMenu.path.substring(0, contextMenu.path.lastIndexOf('/'))
              : ''
            const newPath = parentPath ? `${parentPath}/new-folder` : 'new-folder'
            onFolderCreate(newPath)
            setContextMenu(null)
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// File Icon Helper
// ─────────────────────────────────────────────────────────────

function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

function FileIcon({ extension }: { extension: string }) {
  // Map extensions to colors/icons
  const iconMap: Record<string, { icon: string; color: string }> = {
    ts: { icon: '📘', color: 'text-blue-400' },
    js: { icon: '📘', color: 'text-yellow-400' },
    tsx: { icon: '📘', color: 'text-blue-400' },
    jsx: { icon: '📘', color: 'text-blue-400' },
    html: { icon: '📄', color: 'text-orange-400' },
    css: { icon: '🎨', color: 'text-purple-400' },
    json: { icon: '📋', color: 'text-yellow-400' },
    md: { icon: '📝', color: 'text-green-400' },
    py: { icon: '🐍', color: 'text-green-400' },
    go: { icon: '🐹', color: 'text-blue-400' },
    rs: { icon: '🦀', color: 'text-orange-400' },
    java: { icon: '☕', color: 'text-red-400' },
    cpp: { icon: '⚡', color: 'text-blue-400' },
    c: { icon: '⚡', color: 'text-blue-400' },
    php: { icon: '🐘', color: 'text-purple-400' },
    rb: { icon: '💎', color: 'text-red-400' },
    swift: { icon: '🦅', color: 'text-orange-400' },
    kt: { icon: '🤖', color: 'text-purple-400' },
    vue: { icon: '🟢', color: 'text-green-400' },
    svelte: { icon: '🟠', color: 'text-orange-400' }
  }

  const defaultIcon = { icon: '📄', color: 'text-gray-400' }
  const info = iconMap[extension] || defaultIcon

  return <span className={info.color}>{info.icon}</span>
}
📝 File Operations Handler
File: hooks/useFileOperations.ts
typescript
import { useCallback } from 'react'
import { useFileStore } from '@/stores/fileStore'
import { useCollaboration } from './useCollaboration'

export function useFileOperations(sessionId: string, userId: string) {
  const {
    createFile: createFileStore,
    createFolder: createFolderStore,
    deleteFile: deleteFileStore,
    renameFile: renameFileStore,
    moveFile: moveFileStore,
    updateFileContent: updateFileContentStore,
    getFileContent
  } = useFileStore()

  const {
    createFile: createFileCollab,
    deleteFile: deleteFileCollab,
    renameFile: renameFileCollab,
    getFileText
  } = useCollaboration({ sessionId, userId, userName: '', wsUrl: '' })

  const createFile = useCallback((path: string, content: string = '') => {
    // Create locally
    createFileStore(path, content)

    // Create in yjs
    createFileCollab(path, content)
  }, [createFileStore, createFileCollab])

  const createFolder = useCallback((path: string) => {
    createFolderStore(path)
  }, [createFolderStore])

  const deleteFile = useCallback((path: string) => {
    // Delete locally
    deleteFileStore(path)

    // Delete in yjs
    deleteFileCollab(path)
  }, [deleteFileStore, deleteFileCollab])

  const renameFile = useCallback((oldPath: string, newPath: string) => {
    // Rename locally
    renameFileStore(oldPath, newPath)

    // Rename in yjs
    renameFileCollab(oldPath, newPath)
  }, [renameFileStore, renameFileCollab])

  const moveFile = useCallback((oldPath: string, newPath: string) => {
    moveFileStore(oldPath, newPath)
  }, [moveFileStore])

  const updateFileContent = useCallback((path: string, content: string) => {
    // Update locally
    updateFileContentStore(path, content)

    // yjs handles syncing automatically
    // The yjs text is updated directly in the editor
  }, [updateFileContentStore])

  const getContent = useCallback((path: string) => {
    return getFileContent(path)
  }, [getFileContent])

  return {
    createFile,
    createFolder,
    deleteFile,
    renameFile,
    moveFile,
    updateFileContent,
    getContent
  }
}
🎯 File Tabs Component
File: components/editor/EditorTabs.tsx
typescript
'use client'

import { X } from 'lucide-react'
import { useFileStore } from '@/stores/fileStore'

export function EditorTabs() {
  const { openFiles, activeFile, setActiveFile, closeFile } = useFileStore()

  if (openFiles.length === 0) {
    return null
  }

  return (
    <div className="flex bg-surface border-b border-border overflow-x-auto">
      {openFiles.map((path) => {
        const isActive = path === activeFile
        const fileName = path.split('/').pop() || path

        return (
          <div
            key={path}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm border-r border-border cursor-pointer hover:bg-surface-hover ${
              isActive ? 'bg-surface-hover border-b-2 border-primary' : ''
            }`}
            onClick={() => setActiveFile(path)}
          >
            <span>{fileName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeFile(path)
              }}
              className="p-0.5 hover:bg-surface-hover rounded"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
📊 File Operations Flow
text
┌─────────────────────────────────────────────────────────────────────────┐
│                    File Operation Flow                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. User Action: Create File                                           │
│     └── Owner/Temp Owner only                                          │
│                                                                         │
│  2. Local Update:                                                      │
│     └── Update file tree and contents in Zustand store                │
│                                                                         │
│  3. yjs Update:                                                        │
│     └── Create yjs text for the file                                  │
│                                                                         │
│  4. Broadcast:                                                         │
│     └── Send "file:created" event via WebSocket                       │
│                                                                         │
│  5. Other Clients:                                                     │
│     └── Receive event → Update local file tree                        │
│                                                                         │
│  6. All users:                                                         │
│     └── See the new file in the explorer                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
🧹 Cleanup
File Cleanup on Session Close
typescript
// lib/file-system/cleanup.ts
export function cleanupSessionFiles(sessionId: string) {
  // Clear all file data for the session
  // This is called when a session is closed
  const yjsManager = getYjsManager()
  yjsManager.removeDocument(sessionId)

  // Clear file store
  const fileStore = useFileStore.getState()
  fileStore.loadFiles([])
}
Next: Read 02-sessions.md for session management implementation.
````
