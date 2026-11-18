'use client'

import { useEffect } from 'react'
import { MULTI_TAB_MESSAGE, MULTI_TAB_STORAGE_KEY } from '@/lib/constants'
import { useWebSocketStore } from '@/stores/wsStore'

const TAB_ID = Math.random().toString(36).slice(2)

/**
 * One tab per user, enforced with a LocalStorage heartbeat plus the
 * `storage` event. Returns the reason the tab was blocked, if it was.
 */
export function useTabGuard(): { blocked: boolean; reason: string | null } {
  useTabGuardHeartbeat()

  const stored =
    typeof window === 'undefined' ? null : window.localStorage.getItem(MULTI_TAB_STORAGE_KEY)
  const blocked = stored !== null && stored !== TAB_ID

  return { blocked, reason: blocked ? MULTI_TAB_MESSAGE : null }
}

function useTabGuardHeartbeat(): void {
  useEffect(() => {
    const claim = () => {
      window.localStorage.setItem(MULTI_TAB_STORAGE_KEY, TAB_ID)
    }

    claim()
    const interval = setInterval(claim, 1000)

    // A different tab claiming the key evicts this one.
    const onStorage = (event: StorageEvent) => {
      if (event.key === MULTI_TAB_STORAGE_KEY && event.newValue && event.newValue !== TAB_ID) {
        useWebSocketStore.getState().setError(MULTI_TAB_MESSAGE)
      }
    }

    window.addEventListener('storage', onStorage)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', onStorage)
      if (window.localStorage.getItem(MULTI_TAB_STORAGE_KEY) === TAB_ID) {
        window.localStorage.removeItem(MULTI_TAB_STORAGE_KEY)
      }
    }
  }, [])
}
