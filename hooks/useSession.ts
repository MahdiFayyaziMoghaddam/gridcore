'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/routes'
import { useSessionStore } from '@/stores/sessionStore'
import { useUiStore } from '@/stores/uiStore'
import { useWebSocket } from './useWebSocket'
import { usePermissions } from './usePermissions'

export interface UseSessionActions {
  createSession: (name?: string) => Promise<string>
  joinSession: (sessionId: string) => Promise<void>
  saveSession: () => void
  exportSession: () => void
  closeSession: (save: boolean) => void
  changeSessionId: () => void
  grantOwnership: (userId: string) => void
  revokeOwnership: () => void
  leave: () => void
}

export function useSessionActions(): UseSessionActions {
  const router = useRouter()
  const { sessionId, send } = useWebSocket()
  const permissions = usePermissions()

  const createSession = useCallback(
    async (name?: string) => {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Failed to create session')
      }

      const { sessionId: id } = (await response.json()) as { sessionId: string }
      router.push(ROUTES.session(id))
      return id
    },
    [router]
  )

  const joinSession = useCallback(
    async (targetId: string) => {
      const response = await fetch(`/api/sessions/check/${targetId}`)
      const result = (await response.json()) as {
        exists: boolean
        isActive: boolean
        reason?: string
      }

      if (!result.exists) throw new Error('Session not found')
      if (!result.isActive) throw new Error(result.reason ?? 'Session is not active')

      router.push(ROUTES.session(targetId))
    },
    [router]
  )

  const saveSession = useCallback(() => {
    if (!permissions.canSaveSession) return
    useUiStore.getState().setSaving(true)
    // The server answers with request:save; the provider does the work.
    send('session:save', { sessionId })
  }, [permissions.canSaveSession, send, sessionId])

  const exportSession = useCallback(async () => {
    if (!permissions.canExportSession) return

    const ui = useUiStore.getState()
    ui.setExporting(true)

    try {
      const { createZip } = await import('@/lib/storage/zip')
      const { downloadBlob } = await import('@/lib/file-system/import')
      const { MAX_ZIP_SIZE } = await import('@/lib/constants')
      const { useFileStore } = await import('@/stores/fileStore')

      const blob = await createZip(useFileStore.getState().getTreeMap())

      if (blob.size === 0) {
        ui.notify('No files to export', 'error')
        return
      }

      if (blob.size > MAX_ZIP_SIZE) {
        ui.notify(`Export exceeds the ${MAX_ZIP_SIZE / 1024 / 1024}MB limit`, 'error')
        return
      }

      downloadBlob(blob, `${sessionId}.zip`)
      ui.notify('Export ready', 'success')
    } catch {
      ui.notify('Export failed', 'error')
    } finally {
      ui.setExporting(false)
    }
  }, [permissions.canExportSession, sessionId])

  const closeSession = useCallback(
    (save: boolean) => {
      send('session:close', { sessionId, save })
      useSessionStore.getState().clearSession()
      router.push(ROUTES.sessions)
    },
    [router, send, sessionId]
  )

  const changeSessionId = useCallback(() => {
    if (!permissions.canChangeSessionId) return
    send('session:id-change', { sessionId })
  }, [permissions.canChangeSessionId, send, sessionId])

  const grantOwnership = useCallback(
    (userId: string) => {
      if (!permissions.canGrantTempOwner) return
      send('ownership:grant', { sessionId, userId })
    },
    [permissions.canGrantTempOwner, send, sessionId]
  )

  const revokeOwnership = useCallback(() => {
    if (!permissions.canRevokeTempOwner) return
    send('ownership:revoke', { sessionId })
  }, [permissions.canRevokeTempOwner, send, sessionId])

  const leave = useCallback(() => {
    send('leave', { sessionId })
    useSessionStore.getState().clearSession()
    router.push(ROUTES.sessions)
  }, [router, send, sessionId])

  return {
    createSession,
    joinSession,
    saveSession,
    exportSession,
    closeSession,
    changeSessionId,
    grantOwnership,
    revokeOwnership,
    leave,
  }
}

/** Read-only session slice for components. */
export function useSession() {
  const sessionId = useSessionStore(state => state.sessionId)
  const name = useSessionStore(state => state.name)
  const isSaved = useSessionStore(state => state.isSaved)
  const users = useSessionStore(state => state.users)

  return { sessionId, name, isSaved, users, ...useSessionActions() }
}
