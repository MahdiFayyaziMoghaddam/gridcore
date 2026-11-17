'use client'

import { X } from 'lucide-react'
import { useFileStore } from '@/stores/fileStore'

export function EditorTabs() {
  const openFiles = useFileStore(state => state.openFiles)
  const activeFile = useFileStore(state => state.activeFile)
  const setActiveFile = useFileStore(state => state.setActiveFile)
  const closeFile = useFileStore(state => state.closeFile)

  return (
    <div role="tablist" className="flex shrink-0 overflow-x-auto border-b border-border bg-surface">
      {openFiles.map(path => (
        <div
          key={path}
          role="tab"
          aria-selected={path === activeFile}
          onClick={() => setActiveFile(path)}
          className={
            'group flex shrink-0 cursor-pointer items-center gap-2 border-r border-border px-3 py-1.5 text-xs ' +
            (path === activeFile ? 'bg-background text-accent' : 'text-muted hover:text-text')
          }
        >
          <span className="max-w-[12rem] truncate font-mono">{path.split('/').pop()}</span>
          <button
            onClick={event => {
              event.stopPropagation()
              closeFile(path)
            }}
            className="rounded text-muted opacity-0 hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Close ${path}`}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}