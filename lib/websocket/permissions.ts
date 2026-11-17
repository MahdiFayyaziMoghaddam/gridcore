import { state } from '@/lib/websocket/state'
import type { SessionRole } from '@/types/session'

export enum Permission {
  CREATE_FILE = 'create_file',
  DELETE_FILE = 'delete_file',
  RENAME_FILE = 'rename_file',
  EDIT_FILE = 'edit_file',

  SAVE_SESSION = 'save_session',
  EXPORT_SESSION = 'export_session',
  CHANGE_SESSION_ID = 'change_session_id',
  CLOSE_SESSION = 'close_session',

  GRANT_TEMP_OWNER = 'grant_temp_owner',
  REVOKE_TEMP_OWNER = 'revoke_temp_owner',

  VIEW_FILES = 'view_files',
  CHAT = 'chat',
}

export type FileOperation = 'create' | 'delete' | 'rename' | 'move'

export interface PermissionCheck {
  allowed: boolean
  error?: string
  role?: SessionRole
}

const FILE_OPERATIONS: Record<FileOperation, Permission> = {
  create: Permission.CREATE_FILE,
  delete: Permission.DELETE_FILE,
  rename: Permission.RENAME_FILE,
  move: Permission.RENAME_FILE,
}

/**
 * The single source of truth for authorization. Both the server handlers and
 * the client hooks call this — never hand-roll `userId === session.ownerId`.
 */
export function checkPermission(
  sessionId: string,
  userId: string,
  permission: Permission
): PermissionCheck {
  const session = state.sessions.get(sessionId)
  if (!session) {
    return { allowed: false, error: 'Session not found' }
  }

  if (!session.users.has(userId)) {
    return { allowed: false, error: 'User not in session' }
  }

  const isOwner = session.ownerId === userId
  const isTempOwner = session.tempOwnerId === userId

  const role: SessionRole = isOwner ? 'owner' : isTempOwner ? 'temp_owner' : 'user'

  switch (permission) {
    case Permission.CREATE_FILE:
    case Permission.DELETE_FILE:
    case Permission.RENAME_FILE:
      return isOwner || isTempOwner
        ? { allowed: true, role }
        : { allowed: false, error: 'Only owners can perform file operations', role }

    case Permission.EDIT_FILE:
    case Permission.VIEW_FILES:
    case Permission.CHAT:
      return { allowed: true, role }

    case Permission.SAVE_SESSION:
    case Permission.EXPORT_SESSION:
    case Permission.CHANGE_SESSION_ID:
    case Permission.GRANT_TEMP_OWNER:
    case Permission.REVOKE_TEMP_OWNER:
      return isOwner
        ? { allowed: true, role }
        : { allowed: false, error: 'Only the main owner can perform this action', role }

    case Permission.CLOSE_SESSION: {
      if (isOwner) return { allowed: true, role }
      if (!isTempOwner) {
        return { allowed: false, error: 'Only owners can close the session', role }
      }
      // A temp owner only steps in when the main owner is gone.
      const ownerOnline = state.connections.has(session.ownerId)
      return ownerOnline
        ? {
            allowed: false,
            error: 'Main owner is online, only they can close the session',
            role,
          }
        : { allowed: true, role }
    }

    default:
      return { allowed: false, error: 'Unknown permission', role }
  }
}

export function checkFilePermission(
  sessionId: string,
  userId: string,
  operation: FileOperation
): PermissionCheck {
  return checkPermission(sessionId, userId, FILE_OPERATIONS[operation])
}

export function isOwner(sessionId: string, userId: string): boolean {
  return state.sessions.get(sessionId)?.ownerId === userId
}

export function isTempOwner(sessionId: string, userId: string): boolean {
  return state.sessions.get(sessionId)?.tempOwnerId === userId
}

export function getUserRole(sessionId: string, userId: string): SessionRole {
  const session = state.sessions.get(sessionId)
  if (!session) return 'user'
  if (session.ownerId === userId) return 'owner'
  if (session.tempOwnerId === userId) return 'temp_owner'
  return 'user'
}

export function isOnline(userId: string): boolean {
  return state.connections.has(userId)
}

export function canCloseSession(sessionId: string, userId: string): boolean {
  return checkPermission(sessionId, userId, Permission.CLOSE_SESSION).allowed
}