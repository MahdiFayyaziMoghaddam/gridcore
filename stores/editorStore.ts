import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { getUserColor } from '@/lib/colors'
import type { PresenceStatus } from '@/lib/constants'
import type { CursorPosition, Selection } from '@/types/user'

interface RemoteCursor extends CursorPosition {
  filePath: string
  userName: string
}

interface EditorStore {
  cursors: Map<string, RemoteCursor>
  selections: Map<string, Selection>
  userStatuses: Map<string, PresenceStatus>

  updateCursor: (
    userId: string,
    cursor: CursorPosition & { filePath: string },
    userName?: string
  ) => void
  updateSelection: (userId: string, selection: Selection) => void
  updateUserStatus: (userId: string, status: PresenceStatus) => void
  clearUser: (userId: string) => void
  clearAll: () => void
}

export const useEditorStore = create<EditorStore>()(
  devtools(
    set => ({
      cursors: new Map(),
      selections: new Map(),
      userStatuses: new Map(),

      updateCursor: (userId, cursor, userName = 'Unknown') =>
        set(prev => {
          const cursors = new Map(prev.cursors)
          cursors.set(userId, {
            ...cursor,
            userName,
            color: getUserColor(userId),
          } as RemoteCursor & { color: string })
          return { cursors }
        }),

      updateSelection: (userId, selection) =>
        set(prev => {
          const selections = new Map(prev.selections)
          selections.set(userId, selection)
          return { selections }
        }),

      updateUserStatus: (userId, status) =>
        set(prev => {
          const userStatuses = new Map(prev.userStatuses)
          userStatuses.set(userId, status)
          return { userStatuses }
        }),

      clearUser: userId =>
        set(prev => {
          const cursors = new Map(prev.cursors)
          const selections = new Map(prev.selections)
          const userStatuses = new Map(prev.userStatuses)
          cursors.delete(userId)
          selections.delete(userId)
          userStatuses.delete(userId)
          return { cursors, selections, userStatuses }
        }),

      clearAll: () =>
        set({ cursors: new Map(), selections: new Map(), userStatuses: new Map() }),
    }),
    { name: 'editor-store' }
  )
)