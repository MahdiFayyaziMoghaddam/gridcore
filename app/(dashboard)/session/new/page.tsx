'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/lib/routes'
import { MAX_SESSION_NAME_LENGTH } from '@/lib/constants'

export default function NewSessionPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || undefined }),
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Could not create session')
      setIsLoading(false)
      return
    }

    const { sessionId } = (await response.json()) as { sessionId: string }
    router.push(ROUTES.session(sessionId))
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>New Session</CardTitle>
          <CardDescription>
            You will get a session ID to share. Sessions live only while you or a temp owner is
            connected.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="sessionName" className="text-xs text-muted">
                Session name (optional)
              </label>
              <Input
                id="sessionName"
                name="sessionName"
                maxLength={MAX_SESSION_NAME_LENGTH}
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="My project"
              />
            </div>

            {error && <p className="text-xs text-error">{error}</p>}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}