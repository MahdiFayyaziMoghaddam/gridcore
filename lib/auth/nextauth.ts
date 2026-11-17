import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import { eq } from 'drizzle-orm'
import { JWT_MAX_AGE } from '@/lib/constants'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import type { UserRow } from '@/lib/db/schema'
import { userQueries } from '@/lib/db/queries/users'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
  }
}

type Providers = NextAuthOptions['providers']

/**
 * GitHub/Google are optional. A missing credential pair must not break local
 * dev, so a provider is only registered when its env pair is present.
 */
function optionalOAuthProviders(): Providers {
  const providers: Providers = []

  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: process.env.GITHUB_ID,
        clientSecret: process.env.GITHUB_SECRET,
      })
    )
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    )
  }

  return providers
}

/** Find by provider id, else link the provider onto the row with a matching email. */
async function upsertOAuthUser(
  provider: 'github' | 'google',
  providerId: string,
  email: string,
  name: string
): Promise<UserRow | null> {
  const column = provider === 'github' ? users.githubId : users.googleId

  const [byProvider] = await db.select().from(users).where(eq(column, providerId)).limit(1)
  if (byProvider) return byProvider

  const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (byEmail) {
    const linked = await db
      .update(users)
      .set({ [column.name]: providerId, updatedAt: new Date() })
      .where(eq(users.id, byEmail.id))
      .returning()
    return linked[0] ?? null
  }

  const created = await db
    .insert(users)
    .values({ email, name, [column.name]: providerId })
    .returning()

  return created[0] ?? null
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null
        }

        const user = await userQueries.getByEmail(credentials.email)

        // An OAuth-only account has no password and cannot use this provider.
        if (!user?.password) {
          return null
        }

        const bcrypt = (await import('bcryptjs')).default
        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          return null
        }

        return { id: user.id, name: user.name, email: user.email }
      },
    }),
    ...optionalOAuthProviders(),
  ],

  session: {
    strategy: 'jwt',
    maxAge: JWT_MAX_AGE,
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user?.id) {
        token.id = user.id
        return token
      }

      if (account?.provider && profile) {
        const kind = account.provider === 'github' ? 'github' : account.provider === 'google' ? 'google' : null

        if (kind) {
          const details = profile as Record<string, unknown>

          const providerId =
            kind === 'github'
              ? String(details.id ?? account.providerAccountId)
              : String(details.sub ?? account.providerAccountId)

          const email =
            (details.email as string | undefined) ??
            `${account.providerAccountId}@${account.provider}.local`

          const name =
            (details.name as string | undefined) ??
            (details.login as string | undefined) ??
            email.split('@')[0]!

          const oauthUser = await upsertOAuthUser(kind, providerId, email, name)

          if (oauthUser) {
            token.id = oauthUser.id
          }
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? token.sub ?? ''
      }
      return session
    },
  },
}