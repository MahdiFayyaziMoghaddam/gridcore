'use client'

import { useSessionStore } from '@/stores/sessionStore'
import { useWebSocketStore } from '@/stores/wsStore'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'

export function StatusBar() {
  const isConnected = useWebSocketStore(state => state.isConnected)
  const name = useSessionStore(state => state.name)
  const activeFile = useFileStore(state => state.activeFile)
  const cursorCount = useEditorStore(state => state.cursors.size)

  return (
    <footer className="flex shrink-0 items-center gap-4 border-t border-border bg-surface px-3 text-xs text-muted">
      <span
        className="flex items-center gap-1.5"
        role="status"
        aria-label={isConnected ? 'Connected' : 'Disconnected'}
      >
        <span
          className={isConnected ? 'h-1.5 w-1.5 rounded-full bg-success' : 'h-1.5 w-1.5 rounded-full bg-error'}
          aria-hidden
        />
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>

      {name && <span className="truncate">{name}</span>}
      {activeFile && <span className="truncate text-accent">{activeFile}</span>}
      {cursorCount > 0 && <span>{cursorCount} collaborator{cursorCount === 1 ? '' : 's'}</span>}
    </footer>
  )
}