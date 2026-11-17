import { redirect } from 'next/navigation'
import { SessionWorkspace } from '@/components/session/SessionWorkspace'
import { UUID_PATTERN } from '@/lib/constants'

export const metadata = { title: 'Session — GridCore' }

export default function SessionPage({ params }: { params: { id: string } }) {
  if (!UUID_PATTERN.test(params.id)) {
    redirect('/session/join')
  }

  return <SessionWorkspace sessionId={params.id} />
}