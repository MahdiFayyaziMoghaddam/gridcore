import JSZip from 'jszip'
import {
  MAX_SINGLE_FILE_SIZE,
  MAX_ZIP_SIZE,
  SENSITIVE_PATH_SEGMENTS,
  ZIP_CHUNK_SIZE,
} from '@/lib/constants'
import { isSafeFilePath, validateFileContent } from '@/lib/file-system/security'
import type { FileImportError, FileNode } from '@/types/file'

/** Flat map of path -> content, the currency of both ZIP directions. */
export type FileMap = Record<string, string>

export async function createZip(files: FileMap): Promise<Blob> {
  const zip = new JSZip()

  for (const [path, content] of Object.entries(files)) {
    if (!isSafeFilePath(path)) {
      console.warn(`Skipping unsafe path: ${path}`)
      continue
    }
    zip.file(path, content)
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return blob
}

export interface ExtractResult {
  files: FileMap
  warnings: string[]
  errors: FileImportError[]
}

/**
 * Text-only extraction. Binary entries (content containing \0) are skipped with
 * a warning, not an error — see AGENTS.md §7.
 */
export async function extractZip(blob: Blob): Promise<ExtractResult> {
  const warnings: string[] = []
  const errors: FileImportError[] = []

  if (blob.size === 0) {
    errors.push({ code: 'EMPTY', message: 'File is empty' })
    return { files: {}, warnings, errors }
  }

  if (blob.size > MAX_ZIP_SIZE) {
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: `The file exceeds the ${MAX_ZIP_SIZE / 1024 / 1024}MB size limit`,
    })
    return { files: {}, warnings, errors }
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(blob)
  } catch {
    errors.push({ code: 'CORRUPTED', message: 'The ZIP archive appears to be corrupted' })
    return { files: {}, warnings, errors }
  }

  const files: FileMap = {}

  const entries = Object.values(zip.files).filter(entry => !entry.dir)

  for (const entry of entries) {
    const path = entry.name

    // Zip-slip: reject traversal and absolute paths outright, never sanitize.
    if (!isSafeFilePath(path)) {
      errors.push({
        code: 'INVALID_FORMAT',
        message: `Unsafe path in archive: ${path}`,
      })
      continue
    }

    for (const segment of SENSITIVE_PATH_SEGMENTS) {
      if (path.includes(segment)) {
        warnings.push(`Archive contains ${segment} entries — these were imported as-is`)
        break
      }
    }

    // nodebuffer first so \0 detection is byte-accurate, then read as text.
    const nodeBuffer = await entry.async('nodebuffer')
    if (nodeBuffer.includes(0)) {
      console.warn(`Skipping binary file: ${path}`)
      continue
    }

    const content = await entry.async('string')

    if (content.length > MAX_SINGLE_FILE_SIZE) {
      warnings.push(`${path} exceeds the 10MB single-file limit and was skipped`)
      continue
    }

    if (!validateFileContent(content)) {
      continue
    }

    files[path] = content
  }

  if (Object.keys(files).length === 0 && errors.length === 0) {
    errors.push({ code: 'EMPTY', message: 'The archive contains no files' })
  }

  return { files, warnings, errors }
}

/** Progress helper for large archives; kept chunked so the UI stays responsive. */
export async function chunked<T>(items: T[], size = ZIP_CHUNK_SIZE): Promise<T[][]> {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/** Flatten a file tree back to the path -> content map that ZIP expects. */
export function flattenFileTree(nodes: FileNode[]): FileMap {
  const out: FileMap = {}

  const walk = (list: FileNode[]): void => {
    for (const node of list) {
      if (node.type === 'folder' && node.children) {
        walk(node.children)
      } else if (node.type === 'file') {
        out[node.path] = node.content ?? ''
      }
    }
  }

  walk(nodes)
  return out
}