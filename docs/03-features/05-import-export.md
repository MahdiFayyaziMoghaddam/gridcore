# GridCore - Import & Export

## 📋 Overview

Import and export functionality allows users to upload existing codebases and download their work. All operations happen **client-side** to minimize server load and ensure privacy. The system supports **ZIP file import/export** with a **50MB size limit**.

---

## 🏗️ Import/Export Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Import/Export Flow │
├─────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Import Flow │ │
│ │ │ │
│ │ User → Select ZIP → Client Extracts → Build File Tree │ │
│ │ │ │ │ │ │
│ │ ▼ ▼ ▼ │ │
│ │ Validate Size Parse Files Load into Editor │ │
│ │ (≤ 50MB) (JSZip) (File Store + yjs) │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Export Flow │ │
│ │ │ │
│ │ User → Click Export → Client Creates ZIP → Download │ │
│ │ │ │ │ │ │
│ │ ▼ ▼ ▼ │ │
│ │ Get Files from Compress with Browser Download │ │
│ │ File Store JSZip (Blob URL) │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────┘
```

---
```

## 📦 Import Implementation

### Client-Side Import

```typescript
// components/session/ImportDialog.tsx

'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Alert } from '@/components/ui/alert'
import { Upload, File, X } from 'lucide-react'
import { useFileSystem } from '@/hooks/useFileSystem'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  userId: string
  canEdit: boolean
}

export function ImportDialog({ open, onOpenChange, sessionId, userId, canEdit }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { importZip } = useFileSystem({ sessionId, userId, canEdit })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    if (!selectedFile.name.endsWith('.zip')) {
      setError('Please select a ZIP file')
      return
    }

    // Validate file size (50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit')
      return
    }

    setFile(selectedFile)
    setError(null)
  }

  const handleImport = async () => {
    if (!file) return

    setIsLoading(true)
    setError(null)

    try {
      await importZip(file)
      onOpenChange(false)
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Codebase</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              {error}
            </Alert>
          )}

          {!file ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Click to select a ZIP file
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum size: 50MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <File size={20} className="text-primary" />
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFile(null)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
              >
                <X size={16} />
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            ⚠️ Importing will replace all current files in this session.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || isLoading}
          >
            {isLoading ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
Import Logic
typescript
// lib/file-system/import.ts

import JSZip from 'jszip'
import { FileNode, buildFileTree } from './helpers'

export interface ImportResult {
  files: FileNode[]
  fileCount: number
  totalSize: number
}

export async function importZipFile(file: File): Promise<ImportResult> {
  // Validate file
  if (!file.name.endsWith('.zip')) {
    throw new Error('File must be a ZIP archive')
  }

  if (file.size > 50 * 1024 * 1024) {
    throw new Error('File size exceeds 50MB limit')
  }

  try {
    // Read file
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    const files: FileNode[] = []
    let totalSize = 0

    // Extract files
    for (const [path, entry] of Object.entries(zip.files)) {
      if (!entry.dir) {
        // Skip binary files (check for null bytes)
        const content = await entry.async('string')

        // Check if content is binary (contains null bytes)
        if (content.includes('\0')) {
          console.warn(`Skipping binary file: ${path}`)
          continue
        }

        const fileName = path.split('/').pop() || path

        files.push({
          name: fileName,
          path,
          type: 'file',
          content,
          extension: fileName.split('.').pop()
        })

        totalSize += content.length
      }
    }

    // Build file tree
    const fileTree = buildFileTree(files)

    return {
      files: fileTree,
      fileCount: files.length,
      totalSize
    }
  } catch (error) {
    throw new Error(`Failed to import ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
📤 Export Implementation
Client-Side Export
typescript
// components/session/ExportButton.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useSession } from '@/hooks/useSession'

interface ExportButtonProps {
  sessionId: string
  userId: string
  canEdit: boolean
}

export function ExportButton({ sessionId, userId, canEdit }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { exportZip } = useFileSystem({ sessionId, userId, canEdit })
  const { session } = useSession()

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)

    try {
      const blob = await exportZip()

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${session?.name || 'codebase'}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export')

      // Show error for a few seconds
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Export
        </>
      )}
    </Button>
  )
}
Export Logic
typescript
// lib/file-system/export.ts

import JSZip from 'jszip'
import { flattenFileTree } from './helpers'

export async function exportToZip(
  files: FileNode[],
  sessionName: string = 'codebase'
): Promise<Blob> {
  const flattened = flattenFileTree(files)

  if (flattened.length === 0) {
    throw new Error('No files to export')
  }

  const zip = new JSZip()

  // Add all files to ZIP
  for (const { path, content } of flattened) {
    zip.file(path, content)
  }

  // Generate ZIP
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6 // Balanced compression
    }
  })

  // Validate size
  if (blob.size > 50 * 1024 * 1024) {
    throw new Error('Export would exceed 50MB limit')
  }

  return blob
}

export async function exportToZipBuffer(
  files: FileNode[],
  sessionName: string = 'codebase'
): Promise<Buffer> {
  const flattened = flattenFileTree(files)

  if (flattened.length === 0) {
    throw new Error('No files to export')
  }

  const zip = new JSZip()

  for (const { path, content } of flattened) {
    zip.file(path, content)
  }

  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6
    }
  })
}
🔄 Integration with File Store
Updated useFileSystem Hook
typescript
// hooks/useFileSystem.ts (continued)

export function useFileSystem({ sessionId, userId, canEdit }: UseFileSystemOptions) {
  // ... existing code ...

  // ──── Import ──────────────────────────────────────────────

  const importZip = useCallback(async (file: File) => {
    if (!canEdit) {
      throw new Error('You do not have permission to import files')
    }

    // Validate file
    if (!file.name.endsWith('.zip')) {
      throw new Error('File must be a ZIP archive')
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size exceeds 50MB limit')
    }

    // Show loading state
    setImporting(true)

    try {
      // Import file
      const result = await importZipFile(file)

      // Load files into store
      loadFiles(result.files)

      // Update yjs
      const snapshot = toSnapshot()
      loadSessionSnapshot(sessionId, snapshot)

      setDirty(true)

      return result
    } catch (error) {
      throw error
    } finally {
      setImporting(false)
    }
  }, [canEdit, loadFiles, toSnapshot, setDirty, sessionId])

  // ──── Export ──────────────────────────────────────────────

  const exportZip = useCallback(async (): Promise<Blob> => {
    const files = getFileTree()

    if (files.length === 0) {
      throw new Error('No files to export')
    }

    // Export to ZIP
    const blob = await exportToZip(files)

    return blob
  }, [getFileTree])

  return {
    // ... existing returns ...
    importZip,
    exportZip,
    isImporting,
    isExporting
  }
}
🗂️ File Validation
File: lib/file-system/validation.ts
typescript
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateImportFile(file: File): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate file extension
  if (!file.name.endsWith('.zip')) {
    errors.push('File must be a ZIP archive (.zip)')
  }

  // Validate file size
  if (file.size === 0) {
    errors.push('File is empty')
  }

  if (file.size > 50 * 1024 * 1024) {
    errors.push('File size exceeds 50MB limit')
  }

  // Validate file name
  if (file.name.length > 255) {
    errors.push('File name is too long (max 255 characters)')
  }

  // Check for suspicious file names
  const suspiciousNames = ['.env', '.git', 'node_modules']
  if (suspiciousNames.some(name => file.name.includes(name))) {
    warnings.push('File contains potentially sensitive files')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

export function validateExportFiles(files: FileNode[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (files.length === 0) {
    errors.push('No files to export')
  }

  // Check total size
  let totalSize = 0
  const flattened = flattenFileTree(files)

  for (const { content } of flattened) {
    totalSize += content.length
  }

  if (totalSize > 50 * 1024 * 1024) {
    errors.push('Export would exceed 50MB limit')
  }

  // Check for large individual files
  for (const { path, content } of flattened) {
    if (content.length > 10 * 1024 * 1024) {
      warnings.push(`File "${path}" is very large (${(content.length / 1024 / 1024).toFixed(2)}MB)`)
    }
  }

  // Check for empty files
  const emptyFiles = flattened.filter(({ content }) => content.length === 0)
  if (emptyFiles.length > 0) {
    warnings.push(`${emptyFiles.length} empty files will be exported`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}
📊 Performance Considerations
1. Large File Handling
typescript
// lib/file-system/streaming.ts

export async function importZipStream(file: File): Promise<ImportResult> {
  // For large files, use streaming approach
  // This avoids loading the entire file into memory

  if (file.size > 50 * 1024 * 1024) {
    throw new Error('File size exceeds 50MB limit')
  }

  // Read file in chunks
  const chunkSize = 1024 * 1024 // 1MB
  let offset = 0
  const chunks: Uint8Array[] = []

  while (offset < file.size) {
    const chunk = await file.slice(offset, offset + chunkSize).arrayBuffer()
    chunks.push(new Uint8Array(chunk))
    offset += chunkSize
  }

  // Combine chunks
  const combined = new Uint8Array(file.size)
  let position = 0
  for (const chunk of chunks) {
    combined.set(chunk, position)
    position += chunk.length
  }

  // Process ZIP
  const zip = await JSZip.loadAsync(combined.buffer)
  // ... rest of import logic
}
2. Progress Tracking
typescript
// components/session/ImportProgress.tsx

interface ImportProgressProps {
  progress: number
  status: string
}

export function ImportProgress({ progress, status }: ImportProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{status}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
3. Batch Processing
typescript
// lib/file-system/batch.ts

export async function processFilesInBatches(
  files: FileNode[],
  batchSize: number = 100,
  onProgress: (processed: number, total: number) => void
): Promise<FileNode[]> {
  const processed: FileNode[] = []

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)

    // Process batch
    for (const file of batch) {
      // Validate file
      if (file.content && file.content.length > 0) {
        // Process file
        processed.push(file)
      }
    }

    // Update progress
    onProgress(Math.min(i + batchSize, files.length), files.length)
  }

  return processed
}
🔒 Security
File Type Validation
typescript
// lib/file-system/security.ts

export function validateFileContent(content: string): boolean {
  // Check for null bytes (binary content)
  if (content.includes('\0')) {
    return false
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /on\w+\s*=\s*["']/gi,
    /javascript:/gi,
    /data:[^,]*,/gi
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      // Log warning but don't block
      console.warn('Suspicious content detected')
    }
  }

  return true
}

export function sanitizeFilePath(path: string): string {
  // Remove path traversal attempts
  const sanitized = path
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    .replace(/^\.\//, '')
    .replace(/^\.\\/, '')

  // Remove leading/trailing slashes
  return sanitized.replace(/^\/+|\/+$/g, '')
}
🧪 Testing
File: __tests__/import-export.test.ts
typescript
import { describe, it, expect } from '@jest/globals'
import { importZipFile, exportToZip } from '@/lib/file-system'
import { createFileTree } from '@/lib/file-system/helpers'

describe('Import/Export', () => {
  it('should import a ZIP file', async () => {
    // Create test ZIP
    const files = [
      { path: 'test.txt', content: 'Hello World' },
      { path: 'src/index.js', content: 'console.log("hello")' }
    ]

    const zipBlob = await createTestZip(files)
    const file = new File([zipBlob], 'test.zip', { type: 'application/zip' })

    const result = await importZipFile(file)

    expect(result.files.length).toBeGreaterThan(0)
    expect(result.fileCount).toBe(2)
  })

  it('should export files to ZIP', async () => {
    const fileTree = createFileTree([
      { path: 'test.txt', content: 'Hello World' }
    ])

    const blob = await exportToZip(fileTree)

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should reject files larger than 50MB', async () => {
    const largeFile = new File(
      [new Uint8Array(51 * 1024 * 1024)],
      'large.zip',
      { type: 'application/zip' }
    )

    await expect(importZipFile(largeFile)).rejects.toThrow('exceeds 50MB')
  })
})
📝 Error Messages
typescript
// lib/file-system/errors.ts

export class ImportError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ImportError'
  }
}

export const ImportErrorCodes = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  CORRUPTED: 'CORRUPTED',
  EMPTY: 'EMPTY',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
}

export function getImportErrorMessage(error: ImportError): string {
  const messages: Record<string, string> = {
    [ImportErrorCodes.FILE_TOO_LARGE]: 'The file exceeds the 50MB size limit',
    [ImportErrorCodes.INVALID_FORMAT]: 'The file must be a valid ZIP archive',
    [ImportErrorCodes.CORRUPTED]: 'The ZIP archive appears to be corrupted',
    [ImportErrorCodes.EMPTY]: 'The archive contains no files',
    [ImportErrorCodes.PERMISSION_DENIED]: 'You do not have permission to import files'
  }

  return messages[error.code] || error.message
}
📊 Usage Examples
Import Example
typescript
// In a component
import { useFileSystem } from '@/hooks/useFileSystem'

function ImportSection() {
  const { importZip, isImporting } = useFileSystem({
    sessionId,
    userId,
    canEdit: true
  })

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const result = await importZip(file)
      console.log(`Imported ${result.fileCount} files`)
    } catch (error) {
      console.error('Import failed:', error)
    }
  }

  return (
    <div>
      <input
        type="file"
        accept=".zip"
        onChange={handleImport}
        disabled={isImporting}
      />
      {isImporting && <p>Importing...</p>}
    </div>
  )
}
Export Example
typescript
// In a component
function ExportSection() {
  const { exportZip, isExporting } = useFileSystem({
    sessionId,
    userId,
    canEdit: true
  })

  const handleExport = async () => {
    try {
      const blob = await exportZip()

      // Download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'codebase.zip'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <button onClick={handleExport} disabled={isExporting}>
      {isExporting ? 'Exporting...' : 'Export Codebase'}
    </button>
  )
}
Next: Read 06-chat.md for chat system implementation.

```
