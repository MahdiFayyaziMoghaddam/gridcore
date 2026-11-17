import Link from 'next/link'
import { ROUTES } from '@/lib/routes'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <Link href={ROUTES.home} className="flex items-center gap-2 text-sm font-semibold">
        <span className="h-3 w-3 rounded-sm bg-accent" aria-hidden />
        GridCore
      </Link>

      {children}
    </main>
  )
}