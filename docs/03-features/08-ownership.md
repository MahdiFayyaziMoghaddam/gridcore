# GridCore - Ownership & Permissions

## 📋 Overview

Ownership in GridCore is a **hierarchical permission system** that controls who can perform specific actions within a session. The system has three roles: **Main Owner**, **Temp Owner**, and **Regular User**. Only the Main Owner can grant/revoke Temp Owner status, save sessions, export, and change session IDs.

---

## 🏗️ Ownership Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Ownership Hierarchy │
├─────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Main Owner │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ • Create session │ │ │
│ │ │ • Save session │ │ │
│ │ │ • Export session │ │ │
│ │ │ • Change session ID │ │ │
│ │ │ • Grant/Revoke Temp Owner │ │ │
│ │ │ • Create/Delete files │ │ │
│ │ │ • Close session │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Temp Owner │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ • Create/Delete files │ │ │
│ │ │ • Keep session alive (if Main Owner offline) │ │ │
│ │ │ • Cannot save, export, or change session ID │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Regular User │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ • Edit files │ │ │
│ │ │ • View files │ │ │
│ │ │ • Chat │ │ │
│ │ │ • Cannot create/delete files │ │ │
│ │ │ • Cannot perform any administrative actions │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────┘
```

---
```

## 👑 Permission Matrix

| Action            | Main Owner | Temp Owner | Regular User |
| ----------------- | ---------- | ---------- | ------------ |
| Create Session    | ✅         | ❌         | ❌           |
| Join Session      | ✅         | ✅         | ✅           |
| Leave Session     | ✅         | ✅         | ✅           |
| Edit Files        | ✅         | ✅         | ✅           |
| Create Files      | ✅         | ✅         | ❌           |
| Delete Files      | ✅         | ✅         | ❌           |
| Rename Files      | ✅         | ✅         | ❌           |
| Save Session      | ✅         | ❌         | ❌           |
| Export Session    | ✅         | ❌         | ❌           |
| Change Session ID | ✅         | ❌         | ❌           |
| Grant Temp Owner  | ✅         | ❌         | ❌           |
| Revoke Temp Owner | ✅         | ❌         | ❌           |
| Close Session     | ✅         | ✅\*       | ❌           |

\*Temp Owner can close session, but only if Main Owner is offline

---

## 📦 Permission Check Functions

### File: `lib/websocket/permissions.ts`

```typescript
import { state } from './state'

// ─────────────────────────────────────────────────────────────
// 1. Permission Types
// ─────────────────────────────────────────────────────────────

export enum Permission {
  // File Operations
  CREATE_FILE = 'create_file',
  DELETE_FILE = 'delete_file',
  RENAME_FILE = 'rename_file',
  EDIT_FILE = 'edit_file',

  // Session Operations
  SAVE_SESSION = 'save_session',
  EXPORT_SESSION = 'export_session',
  CHANGE_SESSION_ID = 'change_session_id',
  CLOSE_SESSION = 'close_session',

  // Ownership Operations
  GRANT_TEMP_OWNER = 'grant_temp_owner',
  REVOKE_TEMP_OWNER = 'revoke_temp_owner',

  // View Operations
  VIEW_FILES = 'view_files',
  CHAT = 'chat'
}

export interface PermissionCheck {
  allowed: boolean
  error?: string
  role?: 'owner' | 'temp_owner' | 'user'
}

// ─────────────────────────────────────────────────────────────
// 2. Permission Check Functions
// ─────────────────────────────────────────────────────────────

export function checkPermission(
  sessionId: string,
  userId: string,
  permission: Permission
): PermissionCheck {
  const session = state.sessions.get(sessionId)
  if (!session) {
    return { allowed: false, error: 'Session not found' }
  }

  // Check if user is in session
  if (!session.users.has(userId)) {
    return { allowed: false, error: 'User not in session' }
  }

  const isOwner = session.ownerId === userId
  const isTempOwner = session.tempOwnerId === userId

  // Determine role
  let role: 'owner' | 'temp_owner' | 'user' = 'user'
  if (isOwner) role = 'owner'
  else if (isTempOwner) role = 'temp_owner'

  // Check permissions based on role
  switch (permission) {
    // ──── File Operations ──────────────────────────────

    case Permission.CREATE_FILE:
    case Permission.DELETE_FILE:
    case Permission.RENAME_FILE:
      if (!isOwner && !isTempOwner) {
        return {
          allowed: false,
          error: 'Only owners can perform file operations',
          role
        }
      }
      return { allowed: true, role }

    case Permission.EDIT_FILE:
      // All users can edit files
      return { allowed: true, role }

    // ──── Session Operations ────────────────────────────

    case Permission.SAVE_SESSION:
    case Permission.EXPORT_SESSION:
    case Permission.CHANGE_SESSION_ID:
      if (!isOwner) {
        return {
          allowed: false,
          error: 'Only the main owner can perform this action',
          role
        }
      }
      return { allowed: true, role }

    case Permission.CLOSE_SESSION:
      // Only owner or temp owner (if owner offline) can close
      if (!isOwner && !isTempOwner) {
        return {
          allowed: false,
          error: 'Only owners can close the session',
          role
        }
      }

      // If temp owner, check if owner is offline
      if (isTempOwner && isOwner) {
        return {
          allowed: false,
          error: 'Main owner is online, only they can close the session',
          role
        }
      }

      return { allowed: true, role }

    // ──── Ownership Operations ──────────────────────────

    case Permission.GRANT_TEMP_OWNER:
    case Permission.REVOKE_TEMP_OWNER:
      if (!isOwner) {
        return {
          allowed: false,
          error: 'Only the main owner can manage temporary ownership',
          role
        }
      }
      return { allowed: true, role }

    // ──── View Operations ──────────────────────────────

    case Permission.VIEW_FILES:
    case Permission.CHAT:
      return { allowed: true, role }

    default:
      return { allowed: false, error: 'Unknown permission' }
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Convenience Functions
// ─────────────────────────────────────────────────────────────

export function canCreateFiles(sessionId: string, userId: string): boolean {
  return checkPermission(sessionId, userId, Permission.CREATE_FILE).allowed
}

export function canSaveSession(sessionId: string, userId: string): boolean {
  return checkPermission(sessionId, userId, Permission.SAVE_SESSION).allowed
}

export function canExportSession(sessionId: string, userId: string): boolean {
  return checkPermission(sessionId, userId, Permission.EXPORT_SESSION).allowed
}

export function canChangeSessionId(sessionId: string, userId: string): boolean {
  return checkPermission(sessionId, userId, Permission.CHANGE_SESSION_ID).allowed
}

export function canGrantTempOwner(sessionId: string, userId: string): boolean {
  return checkPermission(sessionId, userId, Permission.GRANT_TEMP_OWNER).allowed
}

export function isOwner(sessionId: string, userId: string): boolean {
  const session = state.sessions.get(sessionId)
  return session?.ownerId === userId
}

export function isTempOwner(sessionId: string, userId: string): boolean {
  const session = state.sessions.get(sessionId)
  return session?.tempOwnerId === userId
}

export function getUserRole(sessionId: string, userId: string): 'owner' | 'temp_owner' | 'user' {
  const session = state.sessions.get(sessionId)
  if (!session) return 'user'

  if (session.ownerId === userId) return 'owner'
  if (session.tempOwnerId === userId) return 'temp_owner'
  return 'user'
}
🔄 Ownership Operations
Grant Temp Owner
typescript
// Client Side
function grantTempOwner(userId: string) {
  ws.send(JSON.stringify({
    type: 'ownership:grant',
    payload: {
      sessionId,
      userId
    }
  }))
}

// Server Side
async function handleOwnershipGrant(payload: { sessionId: string; userId: string }, grantorId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) {
    sendError(state.connections.get(grantorId), 'Session not found')
    return
  }

  // Check permission
  const permission = checkPermission(payload.sessionId, grantorId, Permission.GRANT_TEMP_OWNER)
  if (!permission.allowed) {
    sendError(state.connections.get(grantorId), permission.error!)
    return
  }

  // Check if target user is in session
  if (!session.users.has(payload.userId)) {
    sendError(state.connections.get(grantorId), 'User is not in session')
    return
  }

  // Check if target user is already temp owner
  if (session.tempOwnerId === payload.userId) {
    sendError(state.connections.get(grantorId), 'User is already a temp owner')
    return
  }

  // Grant temp ownership
  session.tempOwnerId = payload.userId

  // Broadcast to all users
  broadcastToSession(payload.sessionId, {
    type: 'ownership:granted',
    payload: {
      userId: payload.userId,
      grantedBy: grantorId
    }
  })

  // Notify the new temp owner
  const targetWs = state.connections.get(payload.userId)
  if (targetWs) {
    targetWs.send(JSON.stringify({
      type: 'ownership:promoted',
      payload: {
        sessionId: payload.sessionId,
        role: 'temp_owner'
      }
    }))
  }
}
Revoke Temp Owner
typescript
// Client Side
function revokeTempOwner() {
  ws.send(JSON.stringify({
    type: 'ownership:revoke',
    payload: { sessionId }
  }))
}

// Server Side
async function handleOwnershipRevoke(payload: { sessionId: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) {
    sendError(state.connections.get(userId), 'Session not found')
    return
  }

  // Check permission
  const permission = checkPermission(payload.sessionId, userId, Permission.REVOKE_TEMP_OWNER)
  if (!permission.allowed) {
    sendError(state.connections.get(userId), permission.error!)
    return
  }

  // Check if there is a temp owner to revoke
  if (!session.tempOwnerId) {
    sendError(state.connections.get(userId), 'No temp owner to revoke')
    return
  }

  const tempOwnerId = session.tempOwnerId

  // Revoke temp ownership
  session.tempOwnerId = undefined

  // Broadcast to all users
  broadcastToSession(payload.sessionId, {
    type: 'ownership:revoked',
    payload: {
      userId: tempOwnerId,
      revokedBy: userId
    }
  })

  // Notify the former temp owner
  const targetWs = state.connections.get(tempOwnerId)
  if (targetWs) {
    targetWs.send(JSON.stringify({
      type: 'ownership:demoted',
      payload: {
        sessionId: payload.sessionId,
        role: 'user'
      }
    }))
  }
}
Transfer Ownership (Main Owner Leaves)
typescript
// When main owner leaves and temp owner exists
async function handleOwnerDisconnect(sessionId: string, ownerId: string) {
  const session = state.sessions.get(sessionId)
  if (!session) return

  // Check if there's a temp owner
  if (session.tempOwnerId && session.users.has(session.tempOwnerId)) {
    // Transfer ownership to temp owner
    const tempOwnerId = session.tempOwnerId

    // Keep the main owner as owner, but temp owner keeps session alive
    // Main owner can reclaim when they reconnect

    broadcastToSession(sessionId, {
      type: 'ownership:transferred',
      payload: {
        tempOwnerId,
        reason: 'Main owner disconnected'
      }
    })

    // Notify temp owner
    const tempWs = state.connections.get(tempOwnerId)
    if (tempWs) {
      tempWs.send(JSON.stringify({
        type: 'ownership:promoted',
        payload: {
          sessionId,
          role: 'temp_owner_active',
          message: 'Main owner disconnected, you are now in charge'
        }
      }))
    }
  } else {
    // No temp owner, close session
    closeSession(sessionId, 'Main owner disconnected without temp owner')
  }
}

// When main owner reconnects
async function handleOwnerReconnect(sessionId: string, ownerId: string) {
  const session = state.sessions.get(sessionId)
  if (!session) return

  // Check if there's a temp owner
  if (session.tempOwnerId) {
    // Reclaim ownership
    const tempOwnerId = session.tempOwnerId

    broadcastToSession(sessionId, {
      type: 'ownership:reclaimed',
      payload: {
        ownerId,
        tempOwnerId,
        reason: 'Main owner reconnected'
      }
    })

    // Notify temp owner
    const tempWs = state.connections.get(tempOwnerId)
    if (tempWs) {
      tempWs.send(JSON.stringify({
        type: 'ownership:demoted',
        payload: {
          sessionId,
          role: 'user',
          message: 'Main owner reconnected'
        }
      }))
    }
  }
}
🎨 UI Components
Owner Controls
typescript
// components/session/OwnerControls.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Crown, Users, Key, Save, Download, Shield } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useUserStore } from '@/stores/userStore'

interface OwnerControlsProps {
  sessionId: string
}

export function OwnerControls({ sessionId }: OwnerControlsProps) {
  const {
    isOwner,
    isTempOwner,
    session,
    saveSession,
    exportSession,
    changeSessionId,
    grantOwnership,
    revokeOwnership
  } = useSession()
  const { users } = useUserStore()

  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  // Only show for owner
  if (!isOwner && !isTempOwner) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveSession()
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = async () => {
    try {
      await exportSession()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const handleChangeId = async () => {
    if (confirm('Changing the session ID will break all existing invite links. Continue?')) {
      try {
        await changeSessionId()
      } catch (error) {
        console.error('Failed to change session ID:', error)
      }
    }
  }

  const handleGrant = async () => {
    if (selectedUser) {
      try {
        await grantOwnership(selectedUser)
        setIsGrantDialogOpen(false)
        setSelectedUser('')
      } catch (error) {
        console.error('Failed to grant ownership:', error)
      }
    }
  }

  const handleRevoke = async () => {
    if (confirm('Revoke temporary ownership from this user?')) {
      try {
        await revokeOwnership()
      } catch (error) {
        console.error('Failed to revoke ownership:', error)
      }
    }
  }

  // Get current temp owner
  const tempOwner = session?.tempOwnerId ? users.get(session.tempOwnerId) : null

  // Get users eligible for temp owner (all users except owner)
  const eligibleUsers = Array.from(users.values())
    .filter(u => u.id !== session?.ownerId && u.isOnline)

  return (
    <div className="flex items-center gap-1">
      {/* Save Button (Main Owner only) */}
      {isOwner && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={isSaving}
          title="Save session"
        >
          <Save size={16} className="mr-1" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      )}

      {/* Export Button (Main Owner only) */}
      {isOwner && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleExport}
          title="Export codebase"
        >
          <Download size={16} />
        </Button>
      )}

      {/* Change Session ID (Main Owner only) */}
      {isOwner && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleChangeId}
          title="Change session ID"
        >
          <Key size={16} />
        </Button>
      )}

      {/* Temp Owner Controls (Main Owner only) */}
      {isOwner && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              title="Manage temporary ownership"
            >
              <Shield size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {tempOwner ? (
              <>
                <DropdownMenuItem className="text-sm">
                  <Crown size={14} className="mr-2 text-yellow-500" />
                  Temp Owner: {tempOwner.name}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRevoke}>
                  Revoke Temp Owner
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => setIsGrantDialogOpen(true)}>
                Grant Temp Owner
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Temp Owner Status (for Temp Owner) */}
      {isTempOwner && !isOwner && (
        <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 rounded text-xs text-yellow-500">
          <Crown size={12} />
          <span>Temp Owner</span>
        </div>
      )}

      {/* Grant Temp Owner Dialog */}
      <Dialog open={isGrantDialogOpen} onOpenChange={setIsGrantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Temporary Ownership</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select a user to grant temporary ownership. They will be able to create and delete files, and keep the session alive if you disconnect.
            </p>

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {eligibleUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGrantDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGrant} disabled={!selectedUser}>
              Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
🔒 Permission Enforcement
Server-Side Enforcement
typescript
// lib/websocket/guard.ts

import { checkPermission, Permission } from './permissions'

export function withPermission(
  permission: Permission,
  handler: (payload: any, userId: string, sessionId: string) => Promise<void>
) {
  return async (payload: any, userId: string) => {
    const { sessionId } = payload

    // Check permission
    const result = checkPermission(sessionId, userId, permission)
    if (!result.allowed) {
      const ws = state.connections.get(userId)
      if (ws) {
        sendError(ws, result.error!)
      }
      return
    }

    // Execute handler
    await handler(payload, userId, sessionId)
  }
}

// Usage
const handleFileCreate = withPermission(
  Permission.CREATE_FILE,
  async (payload, userId, sessionId) => {
    // File creation logic
  }
)
Client-Side Enforcement
typescript
// hooks/usePermissions.ts

import { useSession } from './useSession'

export function usePermissions() {
  const { isOwner, isTempOwner, session } = useSession()

  return {
    canCreateFile: isOwner || isTempOwner,
    canDeleteFile: isOwner || isTempOwner,
    canRenameFile: isOwner || isTempOwner,
    canSaveSession: isOwner,
    canExportSession: isOwner,
    canChangeSessionId: isOwner,
    canGrantTempOwner: isOwner,
    canRevokeTempOwner: isOwner,
    canCloseSession: isOwner || (isTempOwner && !isOwner),
    isOwner,
    isTempOwner,
    isRegularUser: !isOwner && !isTempOwner
  }
}
📊 Ownership Metrics
File: lib/ownership/metrics.ts
typescript
import { state } from '@/lib/websocket/state'

export function getOwnershipMetrics() {
  let sessionsWithTempOwner = 0
  let totalSessions = state.sessions.size

  for (const [, session] of state.sessions) {
    if (session.tempOwnerId) {
      sessionsWithTempOwner++
    }
  }

  return {
    totalSessions,
    sessionsWithTempOwner,
    tempOwnerPercentage: totalSessions > 0
      ? (sessionsWithTempOwner / totalSessions) * 100
      : 0,
    owners: Array.from(state.sessions.values()).map(s => s.ownerId)
  }
}
🧪 Testing
File: __tests__/ownership.test.ts
typescript
import { describe, it, expect } from '@jest/globals'
import { checkPermission, Permission } from '@/lib/websocket/permissions'

describe('Ownership & Permissions', () => {
  it('should allow owner to perform all actions', () => {
    // Mock session with owner
    const sessionId = 'test-session'
    const ownerId = 'owner-123'
    const session = {
      id: sessionId,
      ownerId,
      users: new Set([ownerId])
    }

    // @ts-ignore - mock state
    state.sessions.set(sessionId, session)

    // Test all permissions
    const permissions = [
      Permission.CREATE_FILE,
      Permission.DELETE_FILE,
      Permission.RENAME_FILE,
      Permission.SAVE_SESSION,
      Permission.EXPORT_SESSION,
      Permission.CHANGE_SESSION_ID,
      Permission.GRANT_TEMP_OWNER,
      Permission.REVOKE_TEMP_OWNER,
      Permission.CLOSE_SESSION
    ]

    for (const perm of permissions) {
      const result = checkPermission(sessionId, ownerId, perm)
      expect(result.allowed).toBe(true)
    }
  })

  it('should not allow regular user to create files', () => {
    const sessionId = 'test-session'
    const ownerId = 'owner-123'
    const userId = 'user-456'
    const session = {
      id: sessionId,
      ownerId,
      users: new Set([ownerId, userId])
    }

    // @ts-ignore - mock state
    state.sessions.set(sessionId, session)

    const result = checkPermission(sessionId, userId, Permission.CREATE_FILE)
    expect(result.allowed).toBe(false)
  })
})
Next: Proceed to 04-development/01-setup.md for development setup instructions.

```
