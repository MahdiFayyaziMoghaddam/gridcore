import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateEmail, validatePassword } from '@/lib/auth/password'
import { authQueries } from '@/lib/db/queries/auth'
import { userQueries } from '@/lib/db/queries/users'
import { ApiError } from '@/lib/errors'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().toLowerCase(),
  password: z.string(),
})

export async function POST(request: Request): Promise<NextResponse> {
  try {
    let parsed: z.infer<typeof bodySchema>

    try {
      parsed = bodySchema.parse(await request.json())
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            errors: error.issues.map(i => i.message),
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', errors: ['Invalid request body'] },
        { status: 400 }
      )
    }

    if (!validateEmail(parsed.email)) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', errors: ['Invalid email address'] },
        { status: 400 }
      )
    }

    const password = validatePassword(parsed.password)
    if (!password.valid) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', errors: password.errors },
        { status: 400 }
      )
    }

    const existing = await userQueries.getByEmail(parsed.email)
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered', code: 'CONFLICT' },
        { status: 409 }
      )
    }

    const hashed = await authQueries.hashPassword(parsed.password)

    const created = await userQueries.create({
      name: parsed.name,
      email: parsed.email,
      password: hashed,
    })

    const user = created[0]

    return NextResponse.json(
      { success: true, user: { id: user.id, name: user.name, email: user.email } },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code, ...(error.details ?? {}) },
        { status: error.statusCode }
      )
    }

    console.error('[auth/register] unhandled error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
