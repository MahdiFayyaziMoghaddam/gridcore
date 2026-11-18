import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-handler'
import { UUID_PATTERN } from '@/lib/constants'
import { persistSession } from '@/lib/services/session-service'
import { markSessionSaved } from '@/lib/websocket/server'

const paramsSchema = z.object({ id: z.string().regex(UUID_PATTERN, 'Invalid session ID') })

const bodySchema = z.object({
  zip: z.string().min(1, 'zip is required'),
})

export const POST = withAuth(async (request, context, userId) => {
  const { id } = paramsSchema.parse(context.params)
  const { zip } = bodySchema.parse(await request.json())

  await persistSession(id, userId, zip)
  markSessionSaved(id)

  return NextResponse.json({ success: true, sessionId: id })
})
