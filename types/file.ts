export type FileNodeType = 'file' | 'folder'

/**
 * A node in the session file tree. `content` is present on files only and is a
 * render mirror of the yjs Y.Text — yjs remains the source of truth.
 */
export interface FileNode {
  path: string
  name: string
  content?: string
  type: FileNodeType
  children?: FileNode[]
  extension?: string
  size?: number
}

export interface FileImportError {
  code:
    | 'FILE_TOO_LARGE'
    | 'INVALID_FORMAT'
    | 'CORRUPTED'
    | 'EMPTY'
    | 'PERMISSION_DENIED'
  message: string
}