# GridCore - Routing Structure

## 📋 Overview

This document defines the routing structure for GridCore using Next.js App Router. The routing is organized into authentication routes, main application routes, and API routes.

---

## 🏗️ Route Structure

```text
/app/
├── (auth)/ # Authentication routes (group)
│ ├── login/
│ │ └── page.tsx # Login page
│ ├── register/
│ │ └── page.tsx # Register page
│ └── layout.tsx # Auth layout (centered card)
│
├── (dashboard)/ # Main app routes (group)
│ ├── session/
│ │ ├── [id]/ # Dynamic session route
│ │ │ └── page.tsx # Session page
│ │ ├── join/
│ │ │ └── page.tsx # Join session page
│ │ └── new/
│ │ └── page.tsx # New session page
│ ├── sessions/
│ │ └── page.tsx # Saved sessions list
│ └── layout.tsx # Dashboard layout (navbar + sidebar)
│
├── api/ # API routes
│ ├── auth/
│ │ └── [...nextauth]/
│ │ └── route.ts # NextAuth handlers
│ ├── websocket/
│ │ └── route.ts # WebSocket server
│ ├── sessions/
│ │ ├── route.ts # GET (list), POST (create)
│ │ ├── [id]/
│ │ │ ├── route.ts # GET (load), DELETE
│ │ │ └── save/
│ │ │ └── route.ts # POST (save)
│ │ └── check/
│ │ └── [id]/
│ │ └── route.ts # GET (check availability)
│ └── users/
│ └── me/
│ └── route.ts # GET (current user)
│
├── favicon.ico
```
├── globals.css
├── layout.tsx # Root layout
└── page.tsx # Landing page

text

---

## 📄 Page Components

### Landing Page

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

export default async function HomePage() {
  const session = await getServerSession()

  if (session) {
    redirect('/sessions')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">GridCore</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Real-time multiplayer IDE for collaborative coding
        </p>
        <div className="flex gap-4 justify-center">
          <a href="/login" className="inline-flex items-center justify-center rounded-md bg-accent text-white px-6 py-3 font-medium hover:bg-accent-hover">
            Sign In
          </a>
          <a href="/register" className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-6 py-3 font-medium hover:bg-surface-hover">
            Get Started
          </a>
        </div>
      </div>
    </div>
  )
}
Login Page
typescript
// app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { OAuthButtons } from '@/components/auth/OAuthButtons'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ email: '', password: '' })

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

      router.push('/sessions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="destructive">{error}</Alert>}

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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <OAuthButtons />

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
Sessions List Page
typescript
// app/(dashboard)/sessions/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Calendar, Trash2, FolderOpen, Plus } from 'lucide-react'

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
      if (!response.ok) throw new Error('Failed to load sessions')
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
      const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
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
          <Plus size={16} className="mr-2" />
          New Session
        </Button>
      </div>

      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

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
                  <Button variant="outline" size="sm" onClick={() => loadSession(session.id)}>
                    <FolderOpen size={16} className="mr-1" />
                    Open
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteSession(session.id)}>
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
Session Page
typescript
// app/(dashboard)/session/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useFileStore } from '@/stores/fileStore'
import { Editor } from '@/components/editor/Editor'
import { FileTree } from '@/components/editor/FileTree'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { UserList } from '@/components/collaboration/UserList'
import { Navbar } from '@/components/layout/Navbar'
import { StatusBar } from '@/components/layout/StatusBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { SaveDialog } from '@/components/session/SaveDialog'
import { ImportDialog } from '@/components/session/ImportDialog'

export default function SessionPage() {
  const params = useParams()
  const sessionId = params.id as string

  const { session, isLoading, isOwner, isTempOwner, joinSession } = useSession()
  const { isConnected } = useWebSocket()
  const { loadFiles } = useFileStore()

  const [activeTab, setActiveTab] = useState<'files' | 'chat' | 'users'>('files')
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

  useEffect(() => {
    joinSession(sessionId)
  }, [sessionId, joinSession])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading session...</div>
  }

  if (!session) {
    return <div className="flex items-center justify-center h-screen">Session not found</div>
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <Editor />
          </div>
          <StatusBar />
        </div>
      </div>

      <SaveDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        sessionId={sessionId}
      />

      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        sessionId={sessionId}
      />
    </div>
  )
}
🛣️ Route Protection
Middleware Configuration
typescript
// middleware.ts
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
📊 Route Parameters
Route	Params	Description
/session/[id]	id (UUID)	Session ID to join
/api/sessions/[id]	id (UUID)	Session ID for operations
/api/sessions/check/[id]	id (UUID)	Session ID to check
🔗 Navigation
typescript
// lib/navigation.ts
export const routes = {
  home: '/',
  login: '/login',
  register: '/register',
  sessions: '/sessions',
  session: (id: string) => `/session/${id}`,
  newSession: '/session/new',
  joinSession: '/session/join',
}

export function useNavigate() {
  const router = useRouter()

  return {
    toHome: () => router.push(routes.home),
    toLogin: () => router.push(routes.login),
    toRegister: () => router.push(routes.register),
    toSessions: () => router.push(routes.sessions),
    toSession: (id: string) => router.push(routes.session(id)),
    toNewSession: () => router.push(routes.newSession),
  }
}
Next: Proceed to 08-testing/01-unit-tests.md for testing documentation.

```
