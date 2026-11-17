import { del, head, put } from '@vercel/blob'
import {
  MAX_ZIP_SIZE,
  STORAGE_CONTENT_TYPE,
  STORAGE_PATH_PREFIX,
  UUID_PATTERN,
} from '@/lib/constants'

export interface StorageService {
  upload: (sessionId: string, buffer: Buffer) => Promise<string>
  download: (sessionId: string, zipUrl?: string | null) => Promise<Buffer>
  delete: (sessionId: string, zipUrl?: string | null) => Promise<void>
  exists: (sessionId: string, zipUrl?: string | null) => Promise<boolean>
}

class BlobStorageService implements StorageService {
  private getPath(sessionId: string): string {
    if (!UUID_PATTERN.test(sessionId)) {
      throw new Error('Invalid session ID format')
    }
    return `${STORAGE_PATH_PREFIX}/${sessionId}/codebase.zip`
  }

  async upload(sessionId: string, buffer: Buffer): Promise<string> {
    if (buffer.byteLength > MAX_ZIP_SIZE) {
      throw new Error(`File size exceeds ${MAX_ZIP_SIZE / 1024 / 1024}MB limit`)
    }

    const { url } = await put(this.getPath(sessionId), buffer, {
      contentType: STORAGE_CONTENT_TYPE,
      access: 'private',
    })

    return url
  }

  async download(sessionId: string, zipUrl?: string | null): Promise<Buffer> {
    const location = zipUrl ?? this.getPath(sessionId)
    const meta = await head(location)
    const response = await fetch(meta.downloadUrl || meta.url)
    if (!response.ok) {
      throw new Error(`Failed to download session ${sessionId}`)
    }

    return Buffer.from(await response.arrayBuffer())
  }

  async delete(sessionId: string, zipUrl?: string | null): Promise<void> {
    await del(zipUrl ?? this.getPath(sessionId))
  }

  async exists(sessionId: string, zipUrl?: string | null): Promise<boolean> {
    try {
      await head(zipUrl ?? this.getPath(sessionId))
      return true
    } catch {
      return false
    }
  }
}

export const storageService: StorageService = new BlobStorageService()
