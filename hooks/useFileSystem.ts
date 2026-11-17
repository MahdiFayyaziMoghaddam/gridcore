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
 * The `canEdit` guard is the client-side half of the permission model.
 */
export function useFileSystem(): UseFileSystemReturn {
  const { sessionId, send } = useWebSocket()
  const { canEdit } = usePermissions()

  const files = useFileStore(state => state.files)
  const openFiles = useFileStore(state => state.openFiles)
  const activeFile = useFileStore(state => state.activeFile)

  const store = useFileStore.getState

  const create = useCallback(
    (path: string, content = '') => {
      if (!canEdit) return
      store().createFile(path, content)
      yjsCreateFile(sessionId, path, content)
      send('file:create', { sessionId, path, content })
    },
    [canEdit, send, sessionId]
  )

  const createFolder = useCallback(
    (path: string) => {
      if (!canEdit) return
      store().createFolder(path)
      send('file:create', { sessionId, path, content: '' })
    },
    [canEdit, send, sessionId]
  )

  const remove = useCallback(
    (path: string) => {
      if (!canEdit) return
      store().deleteFile(path)
      yjsDeleteFile(sessionId, path)
      send('file:delete', { sessionId, path })
    },
    [canEdit, send, sessionId]
  )

  const rename = useCallback(
    (oldPath: string, newPath: string) => {
      if (!canEdit) return

      const content = getSessionSnapshot(sessionId)[oldPath] ?? ''
      store().renameFile(oldPath, newPath)
      yjsCreateFile(sessionId, newPath, content)
      yjsDeleteFile(sessionId, oldPath)
      send('file:rename', { sessionId, oldPath, newPath })
    },
    [canEdit, send, sessionId]
  )

  // Monaco edits land here: yjs holds the truth, the store mirrors it.
  const updateContent = useCallback(
    (path: string, content: string) => {
      if (!canEdit) return
      yjsSetFileContent(sessionId, path, content)
      store().setDirty(true)
    },
    [canEdit, sessionId]
  )

  const importZip = useCallback(
    async (file: File) => {
      const ui = useUiStore.getState()

      if (!canEdit) {
        ui.notify('You do not have permission to import files', 'error')
        return
      }

      ui.setImporting(true)

      try {
        const result = await importZipFile(file, file.name, { canEdit })

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

        // Replace the whole codebase, locally and in yjs.
        store().loadFromMap(map)
        loadFilesIntoYjs(sessionId, map)

        for (const path of Object.keys(map)) {
          send('file:create', { sessionId, path, content: map[path] })
        }

        ui.notify(`Imported ${Object.keys(map).length} files`, 'success')
      } finally {
        ui.setImporting(false)
      }
    },
    [canEdit, send, sessionId]
  )

  const exportZip = useCallback(
    async (filename = 'codebase.zip') => {
      const ui = useUiStore.getState()

      if (!canEdit) {
        ui.notify('You do not have permission to export files', 'error')
        return
      }

      ui.setExporting(true)

      try {
        // Build from yjs, not from the store mirror.
        const blob = await createZip(getSessionSnapshot(sessionId))

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
    [canEdit, sessionId]
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