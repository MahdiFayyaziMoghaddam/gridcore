import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-handler'
import { sessionQueries } from '@/lib/db/queries/sessions'
import { createActiveSession } from '@/lib/services/session-service'

const createBody = z.object({
  name: z.string().max(50).optional(),
})

export const GET = withAuth(async (_request, _context, userId) => {
  const saved = await sessionQueries.getSavedByUser(userId)
  return NextResponse.json({ sessions: saved })
})

export const POST = withAuth(async (request, _context, userId) => {
  let name: string | undefined

  try {
    const text = await request.text()
    if (text) {
      name = createBody.parse(JSON.parse(text)).name
    }
  } catch {
    name = undefined
  }

  const session = await createActiveSession(userId, name)

  return NextResponse.json({ sessionId: session.id, name: session.name }, { status: 201 })
})