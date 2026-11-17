'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/lib/routes'
import { UUID_PATTERN } from '@/lib/constants'

export default function JoinSessionPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const trimmed = sessionId.trim()

    if (!UUID_PATTERN.test(trimmed)) {
      setError('That does not look like a session ID')
      return
    }

    setIsLoading(true)

    const response = await fetch(`/api/sessions/check/${trimmed}`)
    const result = (await response.json()) as {
      exists: boolean
      isActive: boolean
      reason?: string
    }

    if (!result.exists) {
      setError('Session not found')
      setIsLoading(false)
      return
    }

    if (!result.isActive) {
      setError(result.reason ?? 'No owner is online — the session is not active')
      setIsLoading(false)
      return
    }

    router.push(ROUTES.session(trimmed))
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join a Session</CardTitle>
          <CardDescription>Paste the session ID someone shared with you.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="sessionId" className="text-xs text-muted">
                Session ID
              </label>
              <Input
                id="sessionId"
                name="sessionId"
                required
                value={sessionId}
                onChange={event => setSessionId(event.target.value)}
                placeholder="123e4567-e89b-12d3-a456-426614174000"
                className="font-mono text-xs"
              />
            </div>

            {error && <p className="text-xs text-error">{error}</p>}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Join
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}