'use client'

import { usePresence } from '@/hooks/usePresence'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useSessionStore } from '@/stores/sessionStore'

export function UserList() {
  const { users } = usePresence()
  const currentUserId = useSessionStore(state => state.currentUserId)
  const ownerId = useSessionStore(state => state.ownerId)
  const tempOwnerId = useSessionStore(state => state.tempOwnerId)

  return (
    <ul className="p-2">
      {users.length === 0 && <li className="text-xs text-muted">Nobody else is here yet.</li>}

      {users.map(user => {
        const role =
          user.id === ownerId
            ? 'Owner'
            : user.id === tempOwnerId
              ? 'Temp Owner'
              : 'User'

        return (
          <li key={user.id} className="flex items-center gap-2 py-1">
            <Avatar className="h-5 w-5" style={{ backgroundColor: user.color }}>
              <AvatarFallback>{(user.name ?? '?').slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate text-sm">
              {user.name}
              {user.id === currentUserId && <span className="text-muted"> (you)</span>}
            </span>
            <span className="text-[10px] uppercase text-muted">{role}</span>
          </li>
        )
      })}
    </ul>
  )
}