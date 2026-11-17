import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { getUserColor } from '@/lib/colors'
import type { PresenceStatus } from '@/lib/constants'
import type { SessionRole, SessionState, SessionUser } from '@/types/session'

interface SessionStore {
  sessionId: string | null
  name: string
  ownerId: string | null
  tempOwnerId: string | null
  isSaved: boolean
  users: Map<string, SessionUser>
  currentUserId: string | null

  setCurrentUser: (userId: string | null) => void
  setSession: (state: SessionState) => void
  setUsers: (users: SessionUser[]) => void
  addUser: (user: SessionUser) => void
  removeUser: (userId: string) => void
  setUserStatus: (userId: string, status: PresenceStatus) => void
  setUserFile: (userId: string, filePath: string) => void
  setTempOwner: (userId: string | null) => void
  setIsSaved: (isSaved: boolean) => void
  setId: (sessionId: string) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionStore>()(
  devtools(
    set => ({
      sessionId: null,
      name: '',
      ownerId: null,
      tempOwnerId: null,
      isSaved: false,
      users: new Map(),
      currentUserId: null,

      setCurrentUser: currentUserId => set({ currentUserId }),

      setSession: state =>
        set({
          sessionId: state.id,
          name: state.name,
          ownerId: state.ownerId,
          tempOwnerId: state.tempOwnerId ?? null,
          isSaved: state.isSaved,
        }),

      setUsers: users =>
        set({
          users: new Map(
            users.map(user => [
              user.id,
              { ...user, color: user.color ?? getUserColor(user.id) },
            ])
          ),
        }),

      addUser: user =>
        set(prev => {
          const users = new Map(prev.users)
          users.set(user.id, { ...user, color: user.color ?? getUserColor(user.id) })
          return { users }
        }),

      removeUser: userId =>
        set(prev => {
          const users = new Map(prev.users)
          users.delete(userId)
          return { users }
        }),

      setUserStatus: (userId, status) =>
        set(prev => {
          const existing = prev.users.get(userId)
          if (!existing) return prev
          const users = new Map(prev.users)
          users.set(userId, { ...existing, status })
          return { users }
        }),

      setUserFile: (userId, filePath) =>
        set(prev => {
          const existing = prev.users.get(userId)
          if (!existing) return prev
          const users = new Map(prev.users)
          users.set(userId, { ...existing, currentFile: filePath })
          return { users }
        }),

      setTempOwner: tempOwnerId => set({ tempOwnerId }),

      setIsSaved: isSaved => set({ isSaved }),

      setId: sessionId => set({ sessionId }),

      clearSession: () =>
        set({
          sessionId: null,
          name: '',
          ownerId: null,
          tempOwnerId: null,
          isSaved: false,
          users: new Map(),
        }),
    }),
    { name: 'session-store' }
  )
)

/**
 * Role is derived, never stored — there is exactly one definition and it
 * mirrors the server's (lib/websocket/permissions.ts).
 */
export function selectRole(state: SessionStore): SessionRole {
  if (!state.currentUserId) return 'user'
  if (state.ownerId === state.currentUserId) return 'owner'
  if (state.tempOwnerId === state.currentUserId) return 'temp_owner'
  return 'user'
}

export function selectIsOwner(state: SessionStore): boolean {
  return selectRole(state) === 'owner'
}

export function selectCanEditFiles(state: SessionStore): boolean {
  const role = selectRole(state)
  return role === 'owner' || role === 'temp_owner'
}