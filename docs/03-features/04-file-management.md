# GridCore - File Management

## 📋 Overview

File management in GridCore handles the file system operations within a session. This includes creating, deleting, renaming files and folders, managing the file tree, and integrating with the editor. File operations are **broadcasted to all users** in real-time, with only the **owner and temp owners** having permission to create/delete files.

---

## 🏗️ File System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ File System Architecture │
├─────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Client (Browser) │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ File Tree │ │ File Store │ │ Monaco │ │ │
│ │ │ (Zustand) │──│ (Content) │──│ Editor │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ │ │ │ │ │ │
│ │ └─────────────────┼─────────────────┘ │ │
│ │ │ │ │
│ │ ┌──────▼──────┐ │ │
│ │ │ yjs │ │ │
│ │ │ (CRDT) │ │ │
│ │ └─────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │
│ │ WebSocket │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ WebSocket Server │ │
│ │ ┌────────────────────────────────────────────────────────────┐│ │
│ │ │ Broadcast Engine ││ │
│ │ │ - Broadcast file operations to all users ││ │
│ │ │ - Validate permissions (owner/temp owner) ││ │
│ │ └────────────────────────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────┘
```

---
```

## 📦 File Store (Zustand)

### File: `stores/fileStore.ts`

```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

// ─────────────────────────────────────────────────────────────
// 1. Types
// ─────────────────────────────────────────────────────────────

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  content?: string
  children?: FileNode[]
  extension?: string
}

export interface FileTree {
  root: string
  children: FileNode[]
}

export interface FileStore {
  // State
  files: FileNode[]
  openFiles: string[] // paths
  activeFile: string | null // path
  fileContents: Map<string, string>
  isDirty: boolean

  // Actions
  loadFiles: (files: FileNode[]) => void
  loadFromSnapshot: (snapshot: Record<string, string>) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  closeAllFiles: () => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  createFile: (path: string, content?: string) => void
  createFolder: (path: string) => void
  deleteFile: (path: string) => void
  renameFile: (oldPath: string, newPath: string) => void
  moveFile: (oldPath: string, newPath: string) => void
  getFileContent: (path: string) => string | null
  getFileTree: () => FileNode[]
  toSnapshot: () => Record<string, string>
  setDirty: (dirty: boolean) => void
  reset: () => void
}

// ─────────────────────────────────────────────────────────────
// 2. Store Implementation
// ─────────────────────────────────────────────────────────────

export const useFileStore = create<FileStore>()(
  devtools(
    (set, get) => ({
      // ──── Initial State ──────────────────────────────────

      files: [],
      openFiles: [],
      activeFile: null,
      fileContents: new Map(),
      isDirty: false,

      // ──── File Operations ──────────────────────────────

      loadFiles: (files: FileNode[]) => {
        set({ files, isDirty: false })
      },

      loadFromSnapshot: (snapshot: Record<string, string>) => {
        // Convert snapshot to file tree
        const fileNodes: FileNode[] = []
        const contents = new Map<string, string>()

        for (const [path, content] of Object.entries(snapshot)) {
          contents.set(path, content)

          // Build file tree from path
          const parts = path.split('/')
          let currentPath = ''

          for (let i = 0; i < parts.length; i++) {
            const isLast = i === parts.length - 1
            const fullPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]

            if (isLast) {
              // Add file
              fileNodes.push({
                name: parts[i],
                path: fullPath,
                type: 'file',
                content: content,
                extension: parts[i].split('.').pop()
              })
            }
            currentPath = fullPath
          }
        }

        set({
          files: fileNodes,
          fileContents: contents,
          isDirty: false
        })
      },

      // ──── File Access ──────────────────────────────────

      openFile: (path: string) => {
        set((state) => {
          if (!state.openFiles.includes(path)) {
            return { openFiles: [...state.openFiles, path] }
          }
          return {}
        })
      },

      closeFile: (path: string) => {
        set((state) => {
          const newOpenFiles = state.openFiles.filter(p => p !== path)
          const newActiveFile = state.activeFile === path
            ? (newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null)
            : state.activeFile
          return {
            openFiles: newOpenFiles,
            activeFile: newActiveFile
          }
        })
      },

      closeAllFiles: () => {
        set({
          openFiles: [],
          activeFile: null
        })
      },

      setActiveFile: (path: string) => {
        set((state) => {
          if (state.openFiles.includes(path)) {
            return { activeFile: path }
          }
          return {}
        })
      },

      updateFileContent: (path: string, content: string) => {
        set((state) => {
          const newContents = new Map(state.fileContents)
          newContents.set(path, content)
          return {
            fileContents: newContents,
            isDirty: true
          }
        })
      },

      // ──── File Operations ──────────────────────────────

      createFile: (path: string, content: string = '') => {
        set((state) => {
          const newContents = new Map(state.fileContents)
          newContents.set(path, content)

          // Add to file tree
          const newFiles = [...state.files]
          const parts = path.split('/')
          const fileName = parts.pop()!
          const dirPath = parts.join('/')

          // Find parent directory
          const parent = findNodeByPath(newFiles, dirPath)
          if (parent && parent.children) {
            parent.children.push({
              name: fileName,
              path,
              type: 'file',
              content,
              extension: fileName.split('.').pop()
            })
          } else if (!dirPath) {
            // Root level
            newFiles.push({
              name: fileName,
              path,
              type: 'file',
              content,
              extension: fileName.split('.').pop()
            })
          }

          return {
            files: newFiles,
            fileContents: newContents,
            isDirty: true
          }
        })
      },

      createFolder: (path: string) => {
        set((state) => {
          const newFiles = [...state.files]
          const parts = path.split('/')
          const folderName = parts.pop()!
          const dirPath = parts.join('/')

          // Find parent directory
          const parent = findNodeByPath(newFiles, dirPath)
          if (parent && parent.children) {
            parent.children.push({
              name: folderName,
              path,
              type: 'folder',
              children: []
            })
          } else if (!dirPath) {
            newFiles.push({
              name: folderName,
              path,
              type: 'folder',
              children: []
            })
          }

          return { files: newFiles }
        })
      },

      deleteFile: (path: string) => {
        set((state) => {
          const newFiles = [...state.files]
          const newContents = new Map(state.fileContents)

          // Remove from content map
          newContents.delete(path)

          // Remove from file tree
          removeNodeByPath(newFiles, path)

          // Close file if open
          const newOpenFiles = state.openFiles.filter(p => p !== path)
          const newActiveFile = state.activeFile === path
            ? (newOpenFiles.length > 0 ? newOpenFiles[0] : null)
            : state.activeFile

          return {
            files: newFiles,
            fileContents: newContents,
            openFiles: newOpenFiles,
            activeFile: newActiveFile,
            isDirty: true
          }
        })
      },

      renameFile: (oldPath: string, newPath: string) => {
        set((state) => {
          const newFiles = [...state.files]
          const newContents = new Map(state.fileContents)

          // Get content from old path
          const content = newContents.get(oldPath)
          if (content !== undefined) {
            newContents.set(newPath, content)
            newContents.delete(oldPath)
          }

          // Rename in file tree
          renameNodeByPath(newFiles, oldPath, newPath)

          // Update open files
          const newOpenFiles = state.openFiles.map(p =>
            p === oldPath ? newPath : p
          )

          const newActiveFile = state.activeFile === oldPath
            ? newPath
            : state.activeFile

          return {
            files: newFiles,
            fileContents: newContents,
            openFiles: newOpenFiles,
            activeFile: newActiveFile,
            isDirty: true
          }
        })
      },

      moveFile: (oldPath: string, newPath: string) => {
        // Same as rename but with different path
        set((state) => {
          const newFiles = [...state.files]
          const newContents = new Map(state.fileContents)

          const content = newContents.get(oldPath)
          if (content !== undefined) {
            newContents.set(newPath, content)
            newContents.delete(oldPath)
          }

          // Move in file tree (remove and add)
          removeNodeByPath(newFiles, oldPath)
          const parts = newPath.split('/')
          const fileName = parts.pop()!
          const dirPath = parts.join('/')

          const parent = findNodeByPath(newFiles, dirPath)
          if (parent && parent.children) {
            parent.children.push({
              name: fileName,
              path: newPath,
              type: 'file',
              content,
              extension: fileName.split('.').pop()
            })
          }

          const newOpenFiles = state.openFiles.map(p =>
            p === oldPath ? newPath : p
          )

          const newActiveFile = state.activeFile === oldPath
            ? newPath
            : state.activeFile

          return {
            files: newFiles,
            fileContents: newContents,
            openFiles: newOpenFiles,
            activeFile: newActiveFile,
            isDirty: true
          }
        })
      },

      // ──── Helpers ──────────────────────────────────────

      getFileContent: (path: string) => {
        return get().fileContents.get(path) || null
      },

      getFileTree: () => {
        return get().files
      },

      toSnapshot: () => {
        const contents = get().fileContents
        const snapshot: Record<string, string> = {}
        for (const [path, content] of contents) {
          snapshot[path] = content
        }
        return snapshot
      },

      setDirty: (dirty: boolean) => {
        set({ isDirty: dirty })
      },

      reset: () => {
        set({
          files: [],
          openFiles: [],
          activeFile: null,
          fileContents: new Map(),
          isDirty: false
        })
      }
    }),
    { name: 'file-store' }
  )
)

// ─────────────────────────────────────────────────────────────
// 3. Tree Helper Functions
// ─────────────────────────────────────────────────────────────

function findNodeByPath(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNodeByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}

function removeNodeByPath(nodes: FileNode[], path: string): boolean {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].path === path) {
      nodes.splice(i, 1)
      return true
    }
    if (nodes[i].children) {
      if (removeNodeByPath(nodes[i].children!, path)) {
        return true
      }
    }
  }
  return false
}

function renameNodeByPath(nodes: FileNode[], oldPath: string, newPath: string): boolean {
  for (const node of nodes) {
    if (node.path === oldPath) {
      node.path = newPath
      node.name = newPath.split('/').pop()!
      return true
    }
    if (node.children) {
      if (renameNodeByPath(node.children, oldPath, newPath)) {
        return true
      }
    }
  }
  return false
}
🗂️ File Tree Component
File: components/editor/FileTree.tsx
typescript
'use client'

import { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder, Plus, Trash2, Pencil, Upload, Download } from 'lucide-react'
import { useFileStore } from '@/stores/fileStore'
import { useSession } from '@/hooks/useSession'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ContextMenu } from '@/components/ui/context-menu'

interface FileTreeProps {
  onFileClick: (path: string) => void
  onFileCreate: (path: string, content?: string) => void
  onFileDelete: (path: string) => void
  onFileRename: (oldPath: string, newPath: string) => void
  canEdit: boolean
}

export function FileTree({ onFileClick, onFileCreate, onFileDelete, onFileRename, canEdit }: FileTreeProps) {
  const { files, openFiles, activeFile } = useFileStore()
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [creatingPath, setCreatingPath] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renamingPath, setRenamingPath] = useState('')

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleCreateFile = (path: string) => {
    setCreatingPath(path)
    setIsCreating(true)
    setNewFileName('')
  }

  const handleCreateConfirm = () => {
    if (newFileName.trim()) {
      const fullPath = creatingPath ? `${creatingPath}/${newFileName}` : newFileName
      onFileCreate(fullPath, '')
      setIsCreating(false)
      setNewFileName('')
    }
  }

  const handleCreateCancel = () => {
    setIsCreating(false)
    setNewFileName('')
  }

  const handleRename = (path: string) => {
    setRenamingPath(path)
    setIsRenaming(true)
    setNewFileName(path.split('/').pop()!)
  }

  const handleRenameConfirm = () => {
    if (newFileName.trim()) {
      const parts = renamingPath.split('/')
      parts.pop()
      const newPath = parts.length > 0 ? `${parts.join('/')}/${newFileName}` : newFileName
      onFileRename(renamingPath, newPath)
      setIsRenaming(false)
      setNewFileName('')
    }
  }

  const handleRenameCancel = () => {
    setIsRenaming(false)
    setNewFileName('')
  }

  const renderTree = (nodes: FileNode[], path: string = '') => {
    return nodes.map((node) => {
      const fullPath = node.path
      const isExpanded = expandedFolders.has(fullPath)
      const isActive = activeFile === fullPath
      const isOpen = openFiles.includes(fullPath)

      if (node.type === 'folder') {
        return (
          <div key={fullPath} className="folder-item">
            <div
              className={`folder-header flex items-center gap-1 px-2 py-1 hover:bg-surface-hover cursor-pointer rounded`}
              onClick={() => toggleFolder(fullPath)}
              onContextMenu={(e) => {
                e.preventDefault()
                if (canEdit) {
                  setContextMenu({ x: e.clientX, y: e.clientY, path: fullPath })
                }
              }}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Folder size={16} className="text-primary" />
              <span className="text-sm">{node.name}</span>
            </div>

            {isExpanded && node.children && (
              <div className="folder-children ml-4">
                {isCreating && creatingPath === fullPath && (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <File size={16} className="text-muted" />
                    <Input
                      size="sm"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateConfirm()
                        if (e.key === 'Escape') handleCreateCancel()
                      }}
                      autoFocus
                      className="h-6 text-sm"
                      placeholder="filename"
                    />
                    <Button size="sm" variant="ghost" onClick={handleCreateConfirm}>✓</Button>
                    <Button size="sm" variant="ghost" onClick={handleCreateCancel}>✕</Button>
                  </div>
                )}
                {renderTree(node.children, fullPath)}
              </div>
            )}
          </div>
        )
      }

      // File node
      return (
        <div
          key={fullPath}
          className={`file-item flex items-center gap-1 px-2 py-1 cursor-pointer rounded ${
            isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-hover'
          } ${isOpen ? 'border-l-2 border-accent' : ''}`}
          onClick={() => onFileClick(fullPath)}
          onContextMenu={(e) => {
            e.preventDefault()
            if (canEdit) {
              setContextMenu({ x: e.clientX, y: e.clientY, path: fullPath })
            }
          }}
        >
          <FileIcon extension={node.extension || ''} />
          {isRenaming && renamingPath === fullPath ? (
            <Input
              size="sm"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameConfirm()
                if (e.key === 'Escape') handleRenameCancel()
              }}
              autoFocus
              className="h-6 text-sm"
            />
          ) : (
            <span className="text-sm">{node.name}</span>
          )}
        </div>
      )
    })
  }

  return (
    <div className="file-tree h-full overflow-y-auto">
      <div className="file-tree-header flex justify-between items-center p-2 border-b border-border">
        <span className="font-semibold text-sm">Explorer</span>
        {canEdit && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleCreateFile('')}
              className="h-6 w-6 p-0"
            >
              <Plus size={14} />
            </Button>
          </div>
        )}
      </div>

      <div className="file-tree-content p-1">
        {files.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            <p>No files</p>
            {canEdit && (
              <p className="mt-2">Click the + button to create a file</p>
            )}
          </div>
        ) : (
          renderTree(files)
        )}
      </div>

      {contextMenu && canEdit && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={contextMenu.path}
          onClose={() => setContextMenu(null)}
          onCreate={() => handleCreateFile(contextMenu.path)}
          onDelete={() => onFileDelete(contextMenu.path)}
          onRename={() => handleRename(contextMenu.path)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// File Icon Component
// ─────────────────────────────────────────────────────────────

function FileIcon({ extension }: { extension: string }) {
  const iconMap: Record<string, string> = {
    'ts': 'typescript',
    'js': 'javascript',
    'jsx': 'react',
    'tsx': 'react',
    'py': 'python',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'txt': 'text',
    'gitignore': 'git',
    'env': 'config',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'xml': 'xml',
    'svg': 'svg',
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'webp': 'image',
    'ico': 'image'
  }

  const iconName = iconMap[extension.toLowerCase()] || 'file'

  // Return appropriate icon based on extension
  return <File size={16} className="text-muted" />
}
📝 File Operations with WebSocket
File: hooks/useFileSystem.ts
typescript
import { useCallback } from 'react'
import { useFileStore } from '@/stores/fileStore'
import { useCollaboration } from './useCollaboration'

interface UseFileSystemOptions {
  sessionId: string
  userId: string
  canEdit: boolean
}

export function useFileSystem({ sessionId, userId, canEdit }: UseFileSystemOptions) {
  const {
    files,
    openFiles,
    activeFile,
    fileContents,
    isDirty,
    loadFiles,
    openFile,
    closeFile,
    setActiveFile,
    updateFileContent,
    createFile,
    deleteFile,
    renameFile,
    getFileContent,
    toSnapshot,
    setDirty
  } = useFileStore()

  const {
    createFile: createFileRemote,
    deleteFile: deleteFileRemote,
    renameFile: renameFileRemote,
    onFileCreated,
    onFileDeleted,
    onFileRenamed
  } = useCollaboration({ sessionId, userId, /* ... */ })

  // ──── Local Operations ──────────────────────────────────

  const handleCreateFile = useCallback((path: string, content: string = '') => {
    if (!canEdit) return

    createFile(path, content)
    createFileRemote(path, content)

    // Open the new file
    openFile(path)
    setActiveFile(path)
  }, [canEdit, createFile, createFileRemote, openFile, setActiveFile])

  const handleDeleteFile = useCallback((path: string) => {
    if (!canEdit) return

    deleteFile(path)
    deleteFileRemote(path)
  }, [canEdit, deleteFile, deleteFileRemote])

  const handleRenameFile = useCallback((oldPath: string, newPath: string) => {
    if (!canEdit) return

    renameFile(oldPath, newPath)
    renameFileRemote(oldPath, newPath)
  }, [canEdit, renameFile, renameFileRemote])

  // ──── Remote Event Handlers ─────────────────────────────

  // Listen for remote file operations
  onFileCreated((path: string, content?: string) => {
    // Check if file already exists locally
    const existing = getFileContent(path)
    if (existing !== null) return

    createFile(path, content || '')
  })

  onFileDeleted((path: string) => {
    deleteFile(path)
  })

  onFileRenamed((oldPath: string, newPath: string) => {
    renameFile(oldPath, newPath)
  })

  // ──── Import/Export ──────────────────────────────────────

  const importZip = useCallback(async (file: File) => {
    // Validate file size
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File exceeds 50MB limit')
    }

    const zipBuffer = await file.arrayBuffer()
    const files = await extractZip(zipBuffer)

    loadFiles(files)
    setDirty(true)
  }, [loadFiles, setDirty])

  const exportZip = useCallback(async (): Promise<Blob> => {
    const snapshot = toSnapshot()
    const zip = new JSZip()

    for (const [path, content] of Object.entries(snapshot)) {
      zip.file(path, content)
    }

    return await zip.generateAsync({ type: 'blob' })
  }, [toSnapshot])

  return {
    // State
    files,
    openFiles,
    activeFile,
    fileContents,
    isDirty,

    // Operations
    createFile: handleCreateFile,
    deleteFile: handleDeleteFile,
    renameFile: handleRenameFile,
    openFile,
    closeFile,
    setActiveFile,
    updateFileContent,
    getFileContent,

    // Import/Export
    importZip,
    exportZip,

    // Dirty state
    setDirty
  }
}
🗂️ File System Helpers
File: lib/file-system/helpers.ts
typescript
import JSZip from 'jszip'

// ─────────────────────────────────────────────────────────────
// 1. ZIP Operations
// ─────────────────────────────────────────────────────────────

export async function createZipFromFiles(
  files: Record<string, string>
): Promise<Buffer> {
  const zip = new JSZip()

  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content)
  }

  return await zip.generateAsync({ type: 'nodebuffer' })
}

export async function extractZip(
  zipBuffer: ArrayBuffer | Buffer
): Promise<FileNode[]> {
  const zip = await JSZip.loadAsync(zipBuffer)
  const files: FileNode[] = []

  for (const [path, entry] of Object.entries(zip.files)) {
    if (!entry.dir) {
      const content = await entry.async('string')
      files.push({
        name: path.split('/').pop()!,
        path,
        type: 'file',
        content,
        extension: path.split('.').pop()
      })
    }
  }

  return files
}

export function validateZipSize(buffer: Buffer): boolean {
  return buffer.length <= 50 * 1024 * 1024 // 50MB
}

// ─────────────────────────────────────────────────────────────
// 2. File Tree Helpers
// ─────────────────────────────────────────────────────────────

export function buildFileTree(files: FileNode[]): FileNode[] {
  const tree: FileNode[] = []
  const map = new Map<string, FileNode>()

  for (const file of files) {
    const parts = file.path.split('/')
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1
      const fullPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]

      if (!map.has(fullPath)) {
        const node: FileNode = {
          name: parts[i],
          path: fullPath,
          type: isLast ? 'file' : 'folder',
          children: isLast ? undefined : []
        }

        if (!isLast) {
          map.set(fullPath, node)
        }

        // Add to parent
        if (currentPath) {
          const parent = map.get(currentPath)
          if (parent && parent.children) {
            parent.children.push(node)
          }
        } else {
          tree.push(node)
        }
      }

      // Set content for file
      if (isLast) {
        const node = map.get(fullPath)
        if (node && node.type === 'file') {
          node.content = file.content
          node.extension = file.extension
        }
      }

      currentPath = fullPath
    }
  }

  return tree
}

export function flattenFileTree(nodes: FileNode[]): { path: string; content: string }[] {
  const result: { path: string; content: string }[] = []

  const traverse = (node: FileNode) => {
    if (node.type === 'file' && node.content !== undefined) {
      result.push({
        path: node.path,
        content: node.content
      })
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  for (const node of nodes) {
    traverse(node)
  }

  return result
}

// ─────────────────────────────────────────────────────────────
// 3. File Type Detection
// ─────────────────────────────────────────────────────────────

export function getFileType(extension: string): string {
  const types: Record<string, string> = {
    // Programming languages
    'ts': 'typescript',
    'tsx': 'typescriptreact',
    'js': 'javascript',
    'jsx': 'javascriptreact',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',

    // Web
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',

    // Configuration
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'xml': 'xml',

    // Documentation
    'md': 'markdown',
    'txt': 'text',
    'rst': 'rst',

    // Others
    'env': 'properties',
    'gitignore': 'ignore'
  }

  return types[extension.toLowerCase()] || 'plaintext'
}

export function isTextFile(extension: string): boolean {
  const textExtensions = new Set([
    'txt', 'md', 'rst', 'json', 'yaml', 'yml', 'toml',
    'xml', 'html', 'css', 'scss', 'sass', 'less',
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c',
    'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala'
  ])

  return textExtensions.has(extension.toLowerCase())
}
🔒 File Permissions
Server-Side Permission Check
typescript
// lib/websocket/permissions.ts
import { state } from './state'

export function checkFilePermission(
  sessionId: string,
  userId: string,
  operation: 'create' | 'delete' | 'rename'
): { allowed: boolean; error?: string } {
  const session = state.sessions.get(sessionId)
  if (!session) {
    return { allowed: false, error: 'Session not found' }
  }

  // Only owner and temp owner can perform file operations
  const isOwner = session.ownerId === userId
  const isTempOwner = session.tempOwnerId === userId

  if (!isOwner && !isTempOwner) {
    return {
      allowed: false,
      error: 'Only owners can perform file operations'
    }
  }

  return { allowed: true }
}
📊 Performance Optimization
1. File Tree Virtualization
typescript
// Use react-window for large file trees
import { FixedSizeList } from 'react-window'

const FileTreeVirtualized = ({ files, onFileClick }) => {
  const flattened = flattenFileTree(files)

  return (
    <FixedSizeList
      height={500}
      itemCount={flattened.length}
      itemSize={24}
    >
      {({ index, style }) => (
        <FileTreeItem
          key={flattened[index].path}
          style={style}
          file={flattened[index]}
          onClick={onFileClick}
        />
      )}
    </FixedSizeList>
  )
}
2. File Content Caching
typescript
// Cache file contents in memory
const fileCache = new Map<string, string>()

function getFileContent(path: string): string | null {
  if (fileCache.has(path)) {
    return fileCache.get(path)!
  }

  // Load from yjs
  const content = yjsManager.getFileContent(sessionId, path)
  fileCache.set(path, content)
  return content
}

function updateFileContent(path: string, content: string): void {
  fileCache.set(path, content)
  yjsManager.updateFileContent(sessionId, path, content)
}
3. Debounced File Operations
typescript
import { debounce } from 'lodash-es'

const debouncedUpdate = debounce((path: string, content: string) => {
  updateFileContent(path, content)
  updateFileContentRemote(path, content)
}, 300)

// Use debounced version for rapid typing
function handleEditorChange(path: string, content: string) {
  debouncedUpdate(path, content)
}
🧪 Testing
File: __tests__/file-management.test.ts
typescript
import { describe, it, expect } from '@jest/globals'
import { useFileStore } from '@/stores/fileStore'

describe('File Management', () => {
  it('should create a file', () => {
    const { createFile, getFileContent } = useFileStore.getState()

    createFile('test.txt', 'Hello World')

    const content = getFileContent('test.txt')
    expect(content).toBe('Hello World')
  })

  it('should delete a file', () => {
    const { createFile, deleteFile, getFileContent } = useFileStore.getState()

    createFile('test.txt', 'Hello World')
    deleteFile('test.txt')

    const content = getFileContent('test.txt')
    expect(content).toBeNull()
  })

  it('should rename a file', () => {
    const { createFile, renameFile, getFileContent } = useFileStore.getState()

    createFile('old.txt', 'Hello World')
    renameFile('old.txt', 'new.txt')

    const content = getFileContent('new.txt')
    expect(content).toBe('Hello World')
  })
})
Next: Read 05-import-export.md for import/export implementation.

```
