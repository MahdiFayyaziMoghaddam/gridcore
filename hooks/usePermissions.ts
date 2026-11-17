'use client'

import { useMemo } from 'react'
import { selectCanEditFiles, selectIsOwner, useSessionStore } from '@/stores/sessionStore'

export interface Permissions {
  canCreateFile: boolean
  canDeleteFile: boolean
  canRenameFile: boolean
  canEdit: boolean
  canSaveSession: boolean
  canExportSession: boolean
  canChangeSessionId: boolean
  canGrantTempOwner: boolean
  canRevokeTempOwner: boolean
  canCloseSession: boolean
  isOwner: boolean
  isTempOwner: boolean
  isRegularUser: boolean
}

/**
 * Client-side mirror of `checkPermission` (lib/websocket/permissions.ts).
 * The server remains the authority — this only gates what the UI offers.
 */
export function usePermissions(): Permissions {
  const ownerId = useSessionStore(state => state.ownerId)
  const tempOwnerId = useSessionStore(state => state.tempOwnerId)
  const currentUserId = useSessionStore(state => state.currentUserId)

  return useMemo(() => {
    const isOwner = !!currentUserId && ownerId === currentUserId
    const isTempOwner = !isOwner && !!currentUserId && tempOwnerId === currentUserId
    const canEditFiles = isOwner || isTempOwner

    return {
      canCreateFile: canEditFiles,
      canDeleteFile: canEditFiles,
      canRenameFile: canEditFiles,
      // Editing file contents is open to every session member.
      canEdit: true,
      canSaveSession: isOwner,
      canExportSession: isOwner,
      canChangeSessionId: isOwner,
      canGrantTempOwner: isOwner,
      canRevokeTempOwner: isOwner,
      canCloseSession: canEditFiles,
      isOwner,
      isTempOwner,
      isRegularUser: !canEditFiles,
    }
  }, [ownerId, tempOwnerId, currentUserId])
}

export { selectCanEditFiles, selectIsOwner }