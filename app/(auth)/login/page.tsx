import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'
import { ROUTES } from '@/lib/routes'

export const metadata = { title: 'Sign in — GridCore' }

export default function LoginPage() {
  return (
    <>
      <LoginForm />
      <p className="text-xs text-muted">
        No account?{' '}
        <Link href={ROUTES.register} className="text-accent hover:underline">
          Register
        </Link>
      </p>
    </>
  )
}