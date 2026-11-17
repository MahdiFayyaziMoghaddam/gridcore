'use client'

import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/routes'

interface Navigate {
  toHome: () => void
  toLogin: () => void
  toRegister: () => void
  toSessions: () => void
  toSession: (id: string) => void
  toNewSession: () => void
  toJoinSession: () => void
}

/** Central navigation helper. Every in-app link goes through here. */
export function useNavigate(): Navigate {
  const router = useRouter()

  return {
    toHome: () => router.push(ROUTES.home),
    toLogin: () => router.push(ROUTES.login),
    toRegister: () => router.push(ROUTES.register),
    toSessions: () => router.push(ROUTES.sessions),
    toSession: id => router.push(ROUTES.session(id)),
    toNewSession: () => router.push(ROUTES.newSession),
    toJoinSession: () => router.push(ROUTES.joinSession),
  }
}