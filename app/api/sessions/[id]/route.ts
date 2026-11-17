import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-handler'
import { UUID_PATTERN } from '@/lib/constants'
import {
  deleteSavedSession,
  loadSavedSession,
} from '@/lib/services/session-service'

const paramsSchema = z.object({ id: z.string().regex(UUID_PATTERN, 'Invalid session ID') })

export const GET = withAuth(async (_request, context, userId) => {
  const { id } = paramsSchema.parse(context.params)
  const result = await loadSavedSession(id, userId)

  return NextResponse.json({
    session: {
      id: result.session.id,
      name: result.session.name,
      ownerId: result.session.ownerId,
      zipUrl: result.session.zipUrl,
      createdAt: result.session.createdAt,
      updatedAt: result.session.updatedAt,
    },
    zip: result.zip,
  })
})

export const DELETE = withAuth(async (_request, context, userId) => {
  const { id } = paramsSchema.parse(context.params)
  await deleteSavedSession(id, userId)

  return NextResponse.json({ success: true })
})