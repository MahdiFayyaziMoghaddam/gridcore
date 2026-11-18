'use client'

import { useCallback } from 'react'
import {
  createFile as yjsCreateFile,
  deleteFile as yjsDeleteFile,
  getSessionSnapshot,
  setFileContent as yjsSetFileContent,
} from '@/lib/collaboration/yjs'
import { MAX_ZIP_SIZE } from '@/lib/constants'
import { flattenTree } from '@/lib/file-system/helpers'
import { downloadBlob, importZipFile } from '@/lib/file-system/import'
import { loadFilesIntoYjs } from '@/lib/collaboration/yjs'
import { createZip } from '@/lib/storage/zip'
import { useFileStore } from '@/stores/fileStore'
import { useUiStore } from '@/stores/uiStore'
import { useWebSocket } from './useWebSocket'
import { usePermissions } from './usePermissions'

export interface UseFileSystemReturn {
  files: ReturnType<typeof useFileStore.getState>['files']
  openFiles: string[]
  activeFile: string | null
  open: (path: string) => void
  close: (path: string) => void
  setActive: (path: string) => void
  create: (path: string, content?: string) => void
  createFolder: (path: string) => void
  remove: (path: string) => void
  rename: (oldPath: string, newPath: string) => void
  updateContent: (path: string, content: string) => void
  getContent: (path: string) => string
  importZip: (file: File) => Promise<void>
  exportZip: (filename?: string) => Promise<void>
}

/**
 * Every mutation is dual-write: local store first, then yjs, then broadcast.
 * Guards follow the canonical permission model (server remains authoritative).
 */
export function useFileSystem(): UseFileSystemReturn {
  const { sessionId, collabSessionId, send } = useWebSocket()
  const {
    canCreateFile,
    canDeleteFile,
    canRenameFile,
    canEditContent,
    canImportFiles,
    canExportSession,
  } = usePermissions()

  const files = useFileStore(state => state.files)
  const openFiles = useFileStore(state => state.openFiles)
  const activeFile = useFileStore(state => state.activeFile)

  const store = useFileStore.getState

  const create = useCallback(
    (path: string, content = '') => {
      if (!canCreateFile) return
      store().createFile(path, content)
      yjsCreateFile(collabSessionId, path, content)
      send('file:create', { sessionId, path, content })
    },
    [canCreateFile, collabSessionId, send, sessionId]
  )

  const createFolder = useCallback(
    (path: string) => {
      if (!canCreateFile) return
      store().createFolder(path)
      send('file:create', { sessionId, path, type: 'folder' })
    },
    [canCreateFile, send, sessionId]
  )

  const remove = useCallback(
    (path: string) => {
      if (!canDeleteFile) return
      store().deleteFile(path)
      yjsDeleteFile(collabSessionId, path)
      send('file:delete', { sessionId, path })
    },
    [canDeleteFile, collabSessionId, send, sessionId]
  )

  const rename = useCallback(
    (oldPath: string, newPath: string) => {
      if (!canRenameFile) return

      const snapshot = getSessionSnapshot(collabSessionId)
      const affectedPaths = Object.keys(snapshot).filter(
        path => path === oldPath || path.startsWith(`${oldPath}/`)
      )

      store().renameFile(oldPath, newPath)

      for (const path of affectedPaths) {
        const nextPath = path === oldPath ? newPath : `${newPath}${path.slice(oldPath.length)}`
        const content = snapshot[path] ?? ''
        yjsCreateFile(collabSessionId, nextPath, content)
        yjsSetFileContent(collabSessionId, nextPath, content)
        yjsDeleteFile(collabSessionId, path)
      }

      send('file:rename', { sessionId, oldPath, newPath })
    },
    [canRenameFile, collabSessionId, send, sessionId]
  )

  // Monaco edits land here: yjs holds the truth, the store mirrors it.
  const updateContent = useCallback(
    (path: string, content: string) => {
      if (!canEditContent) return
      yjsSetFileContent(collabSessionId, path, content)
      store().setDirty(true)
    },
    [canEditContent, collabSessionId]
  )

  const importZip = useCallback(
    async (file: File) => {
      const ui = useUiStore.getState()

      if (!canImportFiles) {
        ui.notify('You do not have permission to import files', 'error')
        return
      }

      ui.setImporting(true)

      try {
        const result = await importZipFile(file, file.name, { canEdit: true })

        for (const error of result.errors) {
          ui.notify(error.message, 'error')
        }
        for (const warning of result.warnings) {
          ui.notify(warning, 'info')
        }

        if (result.errors.length > 0 && result.files.length === 0) return

        const map: Record<string, string> = {}
        for (const node of flattenTree(result.files)) {
          if (node.type === 'file') map[node.path] = node.content ?? ''
        }

        const prevPaths = new Set(Object.keys(store().getTreeMap()))
        for (const path of prevPaths) {
          if (!(path in map)) send('file:delete', { sessionId, path })
        }

        // Replace the whole codebase, locally and in yjs; content sync rides yjs diffs.
        store().loadFromMap(map)
        loadFilesIntoYjs(collabSessionId, map)

        for (const path of Object.keys(map)) {
          if (!prevPaths.has(path)) send('file:create', { sessionId, path, content: map[path] })
        }

        ui.notify(`Imported ${Object.keys(map).length} files`, 'success')
      } finally {
        ui.setImporting(false)
      }
    },
    [canImportFiles, collabSessionId, send, sessionId]
  )

  const exportZip = useCallback(
    async (filename = 'codebase.zip') => {
      const ui = useUiStore.getState()

      if (!canExportSession) {
        ui.notify('You do not have permission to export files', 'error')
        return
      }

      ui.setExporting(true)

      try {
        const blob = await createZip(store().getTreeMap())

        if (blob.size === 0) {
          ui.notify('No files to export', 'error')
          return
        }

        if (blob.size > MAX_ZIP_SIZE) {
          ui.notify(`Export exceeds the ${MAX_ZIP_SIZE / 1024 / 1024}MB limit`, 'error')
          return
        }

        downloadBlob(blob, filename)
        ui.notify('Export ready', 'success')
      } finally {
        ui.setExporting(false)
      }
    },
    [canExportSession, sessionId]
  )

  return {
    files,
    openFiles,
    activeFile,
    open: useCallback((path: string) => store().openFile(path), []),
    close: useCallback((path: string) => store().closeFile(path), []),
    setActive: useCallback((path: string) => store().setActiveFile(path), []),
    create,
    createFolder,
    remove,
    rename,
    updateContent,
    getContent: useCallback((path: string) => store().getContent(path), []),
    importZip,
    exportZip,
  }
}
