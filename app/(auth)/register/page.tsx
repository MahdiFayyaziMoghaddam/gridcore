import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { ROUTES } from '@/lib/routes'

export const metadata = { title: 'Register — GridCore' }

export default function RegisterPage() {
  return (
    <>
      <RegisterForm />
      <p className="text-xs text-muted">
        Already have an account?{' '}
        <Link href={ROUTES.login} className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}