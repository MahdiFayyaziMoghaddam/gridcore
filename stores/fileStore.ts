import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  buildTree,
  createFileNode,
  deleteFileNode,
  findNode,
  renameFileNode,
  sortTree,
  treeToMap,
  updateFileContent,
} from '@/lib/file-system/helpers'
import type { FileNode } from '@/types/file'

interface FileStore {
  files: FileNode[]
  openFiles: string[]
  activeFile: string | null
  /** Render mirror of yjs. Never read this to decide what to write. */
  fileContents: Map<string, string>
  isDirty: boolean

  loadFiles: (files: FileNode[]) => void
  loadFromMap: (map: Record<string, string>) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  createFile: (path: string, content?: string) => void
  createFolder: (path: string) => void
  deleteFile: (path: string) => void
  renameFile: (oldPath: string, newPath: string) => void
  getContent: (path: string) => string
  getTreeMap: () => Record<string, string>
  setDirty: (isDirty: boolean) => void
  reset: () => void
}

export const initialFileState = {
  files: [] as FileNode[],
  openFiles: [] as string[],
  activeFile: null as string | null,
  fileContents: new Map<string, string>(),
  isDirty: false,
}

export const useFileStore = create<FileStore>()(
  devtools(
    set => ({
      ...initialFileState,

      loadFiles: files => {
        const fileContents = new Map<string, string>()
        for (const node of flatten(files)) {
          if (node.type === 'file') fileContents.set(node.path, node.content ?? '')
        }
        set({ files: sortTree(files), fileContents, isDirty: false })
      },

      loadFromMap: map => {
        const files = buildTree(map)
        const fileContents = new Map<string, string>(Object.entries(map))
        set({ files, fileContents, openFiles: [], activeFile: null, isDirty: false })
      },

      openFile: path =>
        set(prev =>
          prev.openFiles.includes(path)
            ? { activeFile: path }
            : { openFiles: [...prev.openFiles, path], activeFile: path }
        ),

      closeFile: path =>
        set(prev => {
          const openFiles = prev.openFiles.filter(file => file !== path)
          const activeFile =
            prev.activeFile === path ? (openFiles[openFiles.length - 1] ?? null) : prev.activeFile
          return { openFiles, activeFile }
        }),

      setActiveFile: path => set({ activeFile: path }),

      updateFileContent: (path, content) =>
        set(prev => {
          const fileContents = new Map(prev.fileContents)
          fileContents.set(path, content)
          return {
            fileContents,
            files: updateFileContent(prev.files, path, content),
            isDirty: true,
          }
        }),

      createFile: (path, content = '') =>
        set(prev => {
          const files = createFileNode(prev.files, path, content)
          const fileContents = new Map(prev.fileContents)
          fileContents.set(path, content)
          return { files, fileContents, isDirty: true }
        }),

      createFolder: path =>
        set(prev => ({ files: createFileNode(prev.files, path, '', 'folder'), isDirty: true })),

      deleteFile: path =>
        set(prev => {
          const fileContents = new Map(prev.fileContents)
          fileContents.delete(path)

          const openFiles = prev.openFiles.filter(file => file !== path)
          const activeFile =
            prev.activeFile === path ? (openFiles[openFiles.length - 1] ?? null) : prev.activeFile

          return {
            files: deleteFileNode(prev.files, path),
            fileContents,
            openFiles,
            activeFile,
            isDirty: true,
          }
        }),

      renameFile: (oldPath, newPath) =>
        set(prev => {
          const files = renameFileNode(prev.files, oldPath, newPath)
          const fileContents = new Map<string, string>()
          for (const node of flatten(files)) {
            if (node.type === 'file') {
              fileContents.set(node.path, node.content ?? prev.fileContents.get(node.path) ?? '')
            }
          }
          const rebasePath = (path: string): string => {
            if (path === oldPath) return newPath
            if (path.startsWith(`${oldPath}/`)) return `${newPath}${path.slice(oldPath.length)}`
            return path
          }
          const openFiles = prev.openFiles.map(rebasePath)
          const activeFile = prev.activeFile ? rebasePath(prev.activeFile) : null
          return { files, fileContents, openFiles, activeFile, isDirty: true }
        }),

      getContent: (path: string): string => {
        const fileContents = useFileStore.getState().fileContents
        const mirrored = fileContents.get(path)

        if (mirrored !== undefined) return mirrored

        const node = findNode(useFileStore.getState().files, path)
        return node?.content ?? ''
      },

      getTreeMap: (): Record<string, string> => treeToMap(useFileStore.getState().files),

      setDirty: (isDirty: boolean): void => set({ isDirty }),

      reset: () => set({ ...initialFileState, fileContents: new Map() }),
    }),
    { name: 'file-store' }
  )
)

function flatten(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = []
  const walk = (list: FileNode[]) => {
    for (const node of list) {
      out.push(node)
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)
  return out
}
