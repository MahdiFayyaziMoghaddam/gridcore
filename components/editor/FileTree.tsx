'use client'

import { useState } from 'react'
import { ChevronRight, FilePlus, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { FileIcon } from '@/components/editor/FileIcon'
import { FILE_TREE_ROW_HEIGHT } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { FileNode } from '@/types/file'

interface FileTreeProps {
  files: FileNode[]
  activeFile: string | null
  canEdit: boolean
  onOpen: (path: string) => void
  onCreate: (path: string) => void
  onCreateFolder: (path: string) => void
  onRename: (oldPath: string, newPath: string) => void
  onDelete: (path: string) => void
}

export function FileTree({
  files,
  activeFile,
  canEdit,
  onOpen,
  onCreate,
  onCreateFolder,
  onRename,
  onDelete,
}: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const toggle = (path: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const startRename = (path: string) => {
    setRenamingPath(path)
    setDraftName(path.split('/').pop() ?? '')
  }

  const commitRename = (node: FileNode) => {
    if (renamingPath && draftName.trim() && draftName !== node.name) {
      const parent = node.path.includes('/')
        ? `${node.path.split('/').slice(0, -1).join('/')}/`
        : ''
      onRename(node.path, `${parent}${draftName.trim()}`)
    }
    setRenamingPath(null)
  }

  const renderNode = (node: FileNode, depth: number) => {
    const isFolder = node.type === 'folder'
    const isOpen = expanded.has(node.path)

    return (
      <div key={node.path}>
        <div
          className={cn(
            'group flex items-center gap-1 rounded-sm pr-1 text-sm hover:bg-surface-hover',
            activeFile === node.path && 'bg-surface-hover text-accent'
          )}
          style={{ height: FILE_TREE_ROW_HEIGHT, paddingLeft: depth * 12 + 4 }}
        >
          {isFolder ? (
            <button
              onClick={() => toggle(node.path)}
              className="flex w-4 shrink-0 items-center justify-center text-muted"
              aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
              aria-expanded={isOpen}
            >
              <ChevronRight
                size={12}
                className={cn('transition-transform', isOpen && 'rotate-90')}
              />
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          <FileIcon node={node} />

          {renamingPath === node.path ? (
            <input
              autoFocus
              value={draftName}
              onChange={event => setDraftName(event.target.value)}
              onBlur={() => commitRename(node)}
              onKeyDown={event => {
                if (event.key === 'Enter') commitRename(node)
                if (event.key === 'Escape') setRenamingPath(null)
              }}
              className="w-full rounded border border-border bg-background px-1 text-xs outline-none"
              aria-label="Rename file"
            />
          ) : (
            <button
              onClick={() => (isFolder ? toggle(node.path) : onOpen(node.path))}
              className="flex-1 truncate text-left"
            >
              {node.name}
            </button>
          )}

          {canEdit && (
            <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
              <button
                onClick={() => {
                  const parent = node.path.includes('/')
                    ? `${node.path.split('/').slice(0, -1).join('/')}/`
                    : ''
                  onCreate(`${parent}untitled.txt`)
                }}
                className="rounded p-0.5 text-muted hover:text-text"
                aria-label={`Create file in ${node.name}`}
              >
                <FilePlus size={12} />
              </button>
              <button
                onClick={() => {
                  const parent = node.path.includes('/')
                    ? `${node.path.split('/').slice(0, -1).join('/')}/`
                    : ''
                  onCreateFolder(`${parent}new-folder`)
                }}
                className="rounded p-0.5 text-muted hover:text-text"
                aria-label={`Create folder in ${node.name}`}
              >
                <FolderPlus size={12} />
              </button>
              <button
                onClick={() => startRename(node.path)}
                className="rounded p-0.5 text-muted hover:text-text"
                aria-label={`Rename ${node.name}`}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => onDelete(node.path)}
                className="rounded p-0.5 text-muted hover:text-error"
                aria-label={`Delete ${node.name}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {isFolder && isOpen && node.children?.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="p-1">
      {files.length === 0 ? (
        <p className="px-2 py-4 text-xs text-muted">No files yet. Import a ZIP to get started.</p>
      ) : (
        files.map(node => renderNode(node, 0))
      )}
    </div>
  )
}