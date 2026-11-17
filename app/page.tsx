import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth/nextauth'
import { ROUTES } from '@/lib/routes'

export default async function LandingPage() {
  const session = await getServerSession(authOptions)

  if (session?.user) {
    redirect(ROUTES.sessions)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 rounded bg-accent" aria-hidden />
        <h1 className="text-3xl font-semibold tracking-tight">GridCore</h1>
      </div>

      <p className="max-w-md text-center text-sm text-muted">
        A real-time multiplayer IDE for the browser. Share a session ID and edit the same code
        together — no installs, no servers to configure.
      </p>

      <div className="flex gap-2">
        <Link
          href={ROUTES.login}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent/80"
        >
          Sign in
        </Link>
        <Link
          href={ROUTES.register}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover"
        >
          Create account
        </Link>
      </div>
    </main>
  )
}