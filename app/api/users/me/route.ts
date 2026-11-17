import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-handler'
import { NotFoundError } from '@/lib/errors'
import { userQueries } from '@/lib/db/queries/users'

export const GET = withAuth(async (_request, _context, userId) => {
  const user = await userQueries.getById(userId)

  if (!user) {
    throw new NotFoundError('User')
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  })
})