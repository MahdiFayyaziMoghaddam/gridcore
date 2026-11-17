'use client'

import { useEffect } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'

const TONE = {
  info: { icon: Info, className: 'border-border text-text' },
  success: { icon: CheckCircle2, className: 'border-success text-success' },
  error: { icon: AlertCircle, className: 'border-error text-error' },
} as const

/** Toasts come straight from uiStore.notifications — no separate queue. */
export function NotificationToast() {
  const notifications = useUiStore(state => state.notifications)
  const dismiss = useUiStore(state => state.dismiss)

  useEffect(() => {
    if (notifications.length === 0) return

    const timers = notifications.map(notification =>
      setTimeout(() => dismiss(notification.id), 4000)
    )

    return () => timers.forEach(clearTimeout)
  }, [notifications, dismiss])

  if (notifications.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {notifications.map(notification => {
        const { icon: Icon, className } = TONE[notification.tone]
        return (
          <div
            key={notification.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-md border bg-surface px-3 py-2 text-sm shadow-lg animate-slide-in ${className}`}
          >
            <Icon size={16} />
            <span>{notification.message}</span>
            <button
              onClick={() => dismiss(notification.id)}
              className="ml-2 rounded text-muted hover:text-text"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}