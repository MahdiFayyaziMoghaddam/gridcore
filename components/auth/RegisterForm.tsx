'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/routes'
import { PASSWORD_MIN_LENGTH } from '@/lib/constants'

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErrors([])

    if (password !== confirmPassword) {
      setErrors(['Passwords do not match'])
      return
    }

    setIsLoading(true)

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
        errors?: string[]
      }
      setErrors(body.errors ?? [body.error ?? 'Registration failed'])
      setIsLoading(false)
      return
    }

    const result = await signIn('credentials', { email, password, redirect: false })

    if (result?.error) {
      router.push(ROUTES.login)
      return
    }

    router.push(ROUTES.sessions)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Minimum {PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, and number.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="name" className="text-xs text-muted">
              Name
            </label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={event => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-xs text-muted">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-xs text-muted">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="text-xs text-muted">
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
            />
          </div>

          {errors.length > 0 && (
            <ul className="space-y-0.5 text-xs text-error">
              {errors.map(message => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Create account
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}