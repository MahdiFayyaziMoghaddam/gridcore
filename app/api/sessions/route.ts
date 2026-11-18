import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-handler'
import { sessionQueries } from '@/lib/db/queries/sessions'
import { ApiError } from '@/lib/errors'
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
  const text = await request.text()

  if (text.trim()) {
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      throw new ApiError(400, 'Invalid JSON body', 'VALIDATION_ERROR')
    }
    name = createBody.parse(body).name
  }

  const session = await createActiveSession(userId, name)

  return NextResponse.json({ sessionId: session.id, name: session.name }, { status: 201 })
})
