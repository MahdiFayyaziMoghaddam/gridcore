import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateEmail, validatePassword } from '@/lib/auth/password'
import { authQueries } from '@/lib/db/queries/auth'
import { userQueries } from '@/lib/db/queries/users'
import { ConflictError, ValidationError } from '@/lib/errors'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().toLowerCase(),
  password: z.string(),
})

export async function POST(request: Request): Promise<NextResponse> {
  let parsed: z.infer<typeof bodySchema>

  try {
    parsed = bodySchema.parse(await request.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.issues.map(i => i.message))
    }
    throw new ValidationError(['Invalid request body'])
  }

  if (!validateEmail(parsed.email)) {
    throw new ValidationError(['Invalid email address'])
  }

  const password = validatePassword(parsed.password)
  if (!password.valid) {
    throw new ValidationError(password.errors)
  }

  const existing = await userQueries.getByEmail(parsed.email)
  if (existing) {
    throw new ConflictError('Email already registered')
  }

  // Hash only after the cheap checks pass.
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
}