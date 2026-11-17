export type SessionRole = 'owner' | 'temp_owner' | 'user'

export interface SessionUser {
  id: string
  name: string
  color?: string
  isOnline: boolean
  status?: import('@/lib/constants').PresenceStatus
  currentFile?: string
}

export interface SessionState {
  id: string
  name: string
  ownerId: string
  tempOwnerId?: string
  isSaved: boolean
  createdAt: Date
}

export interface SavedSession {
  id: string
  name: string
  ownerId: string
  zipUrl?: string | null
  createdAt: string
  updatedAt: string
  savedAt: string
}

export interface SessionCheckResult {
  exists: boolean
  isActive: boolean
  userCount: number
  maxUsers: number
  isSaved: boolean
  reason?: string
}