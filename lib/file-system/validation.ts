import { MAX_SINGLE_FILE_SIZE, MAX_ZIP_SIZE } from '@/lib/constants'
import { validateFileContent, validateFilePath } from '@/lib/file-system/security'

export function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip')
}

export function isWithinZipLimit(file: File): boolean {
  return file.size <= MAX_ZIP_SIZE
}

export function isWithinFileLimit(content: string): boolean {
  return content.length <= MAX_SINGLE_FILE_SIZE
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/** Everything a single file path + content pair must satisfy before entering yjs. */
export function validateFile(path: string, content: string): ValidationResult {
  const errors: string[] = []

  if (!validateFilePath(path)) {
    errors.push(`Unsafe file path: ${path}`)
  }

  if (content.length > MAX_SINGLE_FILE_SIZE) {
    errors.push(`${path} exceeds the 10MB single-file limit`)
  }

  if (!validateFileContent(content)) {
    errors.push(`${path} is not a text file`)
  }

  return { valid: errors.length === 0, errors }
}

export function getFileExtension(path: string): string {
  const name = path.split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

export function getFileName(path: string): string {
  return path.split('/').pop() ?? path
}

export function getParentPath(path: string): string | null {
  const parts = path.split('/')
  if (parts.length <= 1) return null
  return parts.slice(0, -1).join('/')
}