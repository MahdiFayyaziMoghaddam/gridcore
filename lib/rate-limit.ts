import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } from '@/lib/constants'

interface RateLimitRecord {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitRecord>()

/**
 * In-memory fixed-window limiter, keyed by userId.
 * ponytail: per-instance only — swap the Map for Redis if you ever run
 * more than one WS instance (see AGENTS.md §"Scaling").
 */
export function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const record = store.get(key)

  if (!record || now > record.resetTime) {
    store.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

export function rateLimitResetAt(key: string): number {
  return store.get(key)?.resetTime ?? 0
}

export function resetRateLimits(): void {
  store.clear()
}

export function pruneRateLimits(): void {
  const now = Date.now()
  for (const [key, record] of store.entries()) {
    if (now > record.resetTime) {
      store.delete(key)
    }
  }
}