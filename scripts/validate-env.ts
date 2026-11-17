import { validateEnv } from '../lib/env'

const result = validateEnv()

if (!result.success) {
  console.error('Invalid environment variables:')
  for (const error of result.errors ?? []) {
    console.error(`  - ${error}`)
  }
  process.exit(1)
}

console.warn('Environment variables are valid.')