import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ZodError } from 'zod'
import { authOptions } from '@/lib/auth/nextauth'
import { ApiError } from '@/lib/errors'
import { checkRateLimit } from '@/lib/rate-limit'

export interface ApiContext {
  params?: Record<string, string | string[]>
}

export type ApiHandler<C extends ApiContext = ApiContext> = (
  request: Request,
  context: C,
  userId: string
) => Promise<Response>

function errorResponse(error: ApiError): NextResponse {
  return NextResponse.json(
    { error: error.message, code: error.code, ...(error.details ?? {}) },
    { status: error.statusCode }
  )
}

/**
 * Wraps an API handler with auth + rate limiting + error mapping.
 * Handlers throw typed ApiErrors; nothing reaches the client untyped.
 */
export function buildHandler<C extends ApiContext>(
  handler: ApiHandler<C>,
  options: { rateLimit?: boolean } = {}
): (request: Request, context: C) => Promise<Response> {
  const { rateLimit = true } = options

  return async (request: Request, context: C): Promise<Response> => {
    try {
      const session = await getServerSession(authOptions)

      if (!session?.user?.id) {
        throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED')
      }

      if (rateLimit && !checkRateLimit(session.user.id)) {
        const rateLimitError = new ApiError(
          429,
          'Rate limit exceeded',
          'RATE_LIMIT_EXCEEDED'
        )
        return NextResponse.json(
          { error: rateLimitError.message, code: rateLimitError.code },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': '30',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + 60),
            },
          }
        )
      }

      return await handler(request, context, session.user.id)
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(error)
      }

      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', code: 'VALIDATION_ERROR', errors: error.issues.map(i => i.message) },
          { status: 400 }
        )
      }

      // Never leak internals to the client.
      console.error('[api] unhandled error:', error)
      return NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }
  }
}

export function withAuth<C extends ApiContext>(
  handler: ApiHandler<C>
): (request: Request, context: C) => Promise<Response> {
  return buildHandler(handler)
}

export function withoutRateLimit<C extends ApiContext>(
  handler: ApiHandler<C>
): (request: Request, context: C) => Promise<Response> {
  return buildHandler(handler, { rateLimit: false })
}