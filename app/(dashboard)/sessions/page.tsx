'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/routes'
import type { SavedSession } from '@/types/session'

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const body = (await response.json()) as { sessions: SavedSession[] }
        setSessions(body.sessions)
      }
      setIsLoading(false)
    })()
  }, [])

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this saved session?')) return

    const response = await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    if (response.ok) {
      setSessions(prev => prev.filter(session => session.id !== id))
    }
  }

  return (
    <main className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Saved sessions</h1>
          <a href={ROUTES.newSession}>
            <Button>New Session</Button>
          </a>
        </div>

        {isLoading && <p className="text-sm text-muted">Loading...</p>}

        {!isLoading && sessions.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted">
              No saved sessions yet. Create one and it will show up here.
            </CardContent>
          </Card>
        )}

        {sessions.map(session => (
          <Card key={session.id}>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="truncate text-base">{session.name}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(session.id)}
                aria-label={`Delete ${session.name}`}
              >
                <Trash2 size={14} />
              </Button>
            </CardHeader>
            <CardContent className="text-xs text-muted">
              <p className="font-mono">{session.id}</p>
              <p className="mt-1">Saved {new Date(session.savedAt).toLocaleString()}</p>
              <a
                href={ROUTES.session(session.id)}
                className="mt-2 inline-block text-accent hover:underline"
              >
                Open session
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}