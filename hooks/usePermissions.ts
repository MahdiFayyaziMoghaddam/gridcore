'use client'

import { useMemo } from 'react'
import { selectCanEditFiles, selectIsOwner, useSessionStore } from '@/stores/sessionStore'

export interface Permissions {
  canCreateFile: boolean
  canDeleteFile: boolean
  canRenameFile: boolean
  canEditContent: boolean
  canImportFiles: boolean
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
  const users = useSessionStore(state => state.users)

  return useMemo(() => {
    const isOwner = !!currentUserId && ownerId === currentUserId
    const isTempOwner = !isOwner && !!currentUserId && tempOwnerId === currentUserId
    const canEditFiles = isOwner || isTempOwner
    const ownerOnline = !!ownerId && users.has(ownerId)

    return {
      canCreateFile: canEditFiles,
      canDeleteFile: canEditFiles,
      canRenameFile: canEditFiles,
      canEditContent: !!currentUserId,
      canImportFiles: canEditFiles,
      canSaveSession: isOwner,
      canExportSession: isOwner,
      canChangeSessionId: isOwner,
      canGrantTempOwner: isOwner,
      canRevokeTempOwner: isOwner,
      canCloseSession: isOwner || (isTempOwner && !ownerOnline),
      isOwner,
      isTempOwner,
      isRegularUser: !canEditFiles,
    }
  }, [ownerId, tempOwnerId, currentUserId, users])
}

export { selectCanEditFiles, selectIsOwner }
