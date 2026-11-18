import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withoutRateLimit } from '@/lib/api-handler'
import { UUID_PATTERN } from '@/lib/constants'
import { checkSession } from '@/lib/services/session-service'

const paramsSchema = z.object({ id: z.string().regex(UUID_PATTERN, 'Invalid session ID') })

/**
 * Authenticated read used by the join screen. Always 200 — "not found" and
 * "found but inactive" are both valid answers, not errors.
 */
export const GET = withoutRateLimit(async (_request, context) => {
  const { id } = paramsSchema.parse(context.params)
  const result = await checkSession(id)

  return NextResponse.json(result)
})
