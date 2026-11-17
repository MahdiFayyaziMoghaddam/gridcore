/**
 * Path and content security for the file system.
 *
 * Everything here REJECTS. Nothing sanitizes — a path we would have to rewrite
 * is a path we refuse to accept (see AGENTS.md §7 and §13 item 4).
 */

import { MAX_FILE_NAME_LENGTH } from '@/lib/constants'

export function validateFileName(name: string): boolean {
  if (!name || name.length > MAX_FILE_NAME_LENGTH) return false
  if (name.includes('..')) return false
  if (name.includes('/') || name.includes('\\')) return false
  return true
}

export function validateFilePath(path: string): boolean {
  if (!path) return false
  if (path.includes('..')) return false
  if (path.startsWith('/') || path.startsWith('\\')) return false
  if (path.includes('\\')) return false
  // Reject drive letters and UNC-ish input.
  if (/^[a-zA-Z]:/.test(path)) return false
  return true
}

export function isSafeFilePath(path: string): boolean {
  return validateFilePath(path)
}

const SUSPICIOUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /on\w+\s*=\s*["']/gi,
  /javascript:/gi,
  /data:[^,]*,/gi,
]

/**
 * Warns on suspicious content but never blocks — GridCore edits arbitrary
 * source files, so pattern matching here is advisory only.
 */
export function validateFileContent(content: string): boolean {
  if (content.includes('\0')) {
    return false
  }

  if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(content))) {
    console.warn('Suspicious content detected')
  }

  return true
}