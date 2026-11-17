import { del, head, put } from '@vercel/blob'
import {
  MAX_ZIP_SIZE,
  STORAGE_CONTENT_TYPE,
  STORAGE_PATH_PREFIX,
  UUID_PATTERN,
} from '@/lib/constants'

export interface StorageService {
  upload: (sessionId: string, buffer: Buffer) => Promise<string>
  download: (sessionId: string) => Promise<Buffer>
  delete: (sessionId: string) => Promise<void>
  exists: (sessionId: string) => Promise<boolean>
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

  async download(sessionId: string): Promise<Buffer> {
    const exists = await this.exists(sessionId)
    if (!exists) {
      throw new Error(`Session ${sessionId} not found in storage`)
    }

    const response = await fetch(this.getPath(sessionId))
    if (!response.ok) {
      throw new Error(`Failed to download session ${sessionId}`)
    }

    return Buffer.from(await response.arrayBuffer())
  }

  async delete(sessionId: string): Promise<void> {
    await del(this.getPath(sessionId))
  }

  async exists(sessionId: string): Promise<boolean> {
    try {
      const result = await head(this.getPath(sessionId))
      return result !== null
    } catch {
      return false
    }
  }
}

export const storageService: StorageService = new BlobStorageService()