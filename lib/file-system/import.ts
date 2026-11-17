import { buildTree } from '@/lib/file-system/helpers'
import { isZipFile, isWithinZipLimit } from '@/lib/file-system/validation'
import { createZip, extractZip, type FileMap } from '@/lib/storage/zip'
import type { FileImportError, FileNode } from '@/types/file'

export interface ImportResult {
  files: FileNode[]
  warnings: string[]
  errors: FileImportError[]
}

/**
 * Client-side import. The ZIP is expanded here, never on the server, and every
 * entry has already passed the reject-not-sanitize path check in extractZip.
 */
export async function importZipFile(
  blob: Blob,
  filename: string,
  options: { canEdit: boolean }
): Promise<ImportResult> {
  if (!options.canEdit) {
    return {
      files: [],
      warnings: [],
      errors: [{ code: 'PERMISSION_DENIED', message: 'You do not have permission to import files' }],
    }
  }

  if (!isZipFile({ name: filename } as File)) {
    return {
      files: [],
      warnings: [],
      errors: [{ code: 'INVALID_FORMAT', message: 'The file must be a valid ZIP archive' }],
    }
  }

  if (!isWithinZipLimit({ size: blob.size } as File)) {
    return {
      files: [],
      warnings: [],
      errors: [
        {
          code: 'FILE_TOO_LARGE',
          message: `The file exceeds the ${50}MB size limit`,
        },
      ],
    }
  }

  const { files, warnings, errors } = await extractZip(blob)
  return { files: buildTree(files), warnings, errors }
}

/** Build the ZIP the server will persist. Size is checked after generation. */
export async function exportZipFiles(
  files: FileNode[],
  options: { canEdit: boolean }
): Promise<{ blob: Blob; errors: FileImportError[] }> {
  if (!options.canEdit) {
    return {
      blob: new Blob(),
      errors: [{ code: 'PERMISSION_DENIED', message: 'You do not have permission to export files' }],
    }
  }

  const map: FileMap = {}
  for (const node of flatten(files)) {
    if (node.type === 'file') {
      map[node.path] = node.content ?? ''
    }
  }

  if (Object.keys(map).length === 0) {
    return { blob: new Blob(), errors: [{ code: 'EMPTY', message: 'No files to export' }] }
  }

  return { blob: await createZip(map), errors: [] }
}

function flatten(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = []
  const walk = (list: FileNode[]): void => {
    for (const node of list) {
      out.push(node)
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)
  return out
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}