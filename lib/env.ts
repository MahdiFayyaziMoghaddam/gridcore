import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),

  NEXT_PUBLIC_WS_URL: z.string().url().optional(),
  BLOB_STORAGE_REGION: z.string().optional(),

  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(source: NodeJS.ProcessEnv = process.env): {
  success: boolean
  data?: Env
  errors?: string[]
} {
  const result = envSchema.safeParse(source)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.issues.map(issue => {
    const key = issue.path.join('.') || '(root)'
    return `${key}: ${issue.message}`
  })

  return { success: false, errors }
}