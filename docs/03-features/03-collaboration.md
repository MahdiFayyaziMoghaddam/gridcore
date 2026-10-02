# GridCore - Real-Time Collaboration

## 📋 Overview

Real-time collaboration in GridCore is powered by **yjs** (CRDT library) running on each client. The server acts as a **message broker** that broadcasts diffs between clients. This approach ensures that all clients maintain a consistent state without requiring server-side state management.

---

## 🏗️ Collaboration Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Collaboration Architecture │
├─────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Client A │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ yjs Doc │ │ Awareness │ │ Monaco │ │ │
│ │ │ (CRDT) │──│ (Cursor) │──│ Editor │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ │ │ │ │ │
│ └─────────┼─────────────────┼────────────────────────────────────┘ │
│ │ │ │
│ │ Diff │ Cursor Update │
│ ▼ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ WebSocket Server │ │
│ │ ┌────────────────────────────────────────────────────────────┐│ │
│ │ │ Broadcast Engine ││ │
│ │ └────────────────────────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │ │
│ │ Diff │ Cursor Update │
│ ▼ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Client B │ │
│ │ ┌──────────────┐ ┌────────────__┐ ┌──────────────┐ │ │
│ │ │ yjs Doc │ │ Awareness │ │ Monaco │ │ │
│ │ │ (CRDT) │──│ (Cursor) │──│ Editor │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────┘
```

---
```

## 📦 yjs Integration

### File: `lib/collaboration/yjs.ts`

```typescript
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'

// ─────────────────────────────────────────────────────────────
// 1. Document Manager
// ─────────────────────────────────────────────────────────────

export class YjsDocumentManager {
  private docs: Map<string, Y.Doc> = new Map()
  private awareness: Map<string, Awareness> = new Map()

  // Get or create document for a session
  getDocument(sessionId: string): Y.Doc {
    if (!this.docs.has(sessionId)) {
      const doc = new Y.Doc()
      this.docs.set(sessionId, doc)

      // Initialize awareness
      const awareness = new Awareness(doc)
      this.awareness.set(sessionId, awareness)
    }
    return this.docs.get(sessionId)!
  }

  // Get awareness for a session
  getAwareness(sessionId: string): Awareness {
    if (!this.awareness.has(sessionId)) {
      this.getDocument(sessionId) // Creates both
    }
    return this.awareness.get(sessionId)!
  }

  // Get or create text for a file
  getFileText(sessionId: string, filePath: string): Y.Text {
    const doc = this.getDocument(sessionId)
    const key = `file:${filePath}`

    // Check if text already exists
    let text = doc.getText(key)
    if (text.length === 0) {
      // Initialize with empty content
      text.insert(0, '')
    }
    return text
  }

  // Remove document
  removeDocument(sessionId: string): void {
    const doc = this.docs.get(sessionId)
    if (doc) {
      doc.destroy()
      this.docs.delete(sessionId)
      this.awareness.delete(sessionId)
    }
  }

  // Get all file paths in a session
  getFilePaths(sessionId: string): string[] {
    const doc = this.docs.get(sessionId)
    if (!doc) return []

    const paths: string[] = []
    const keys = doc.share.keys()
    for (const key of keys) {
      if (key.startsWith('file:')) {
        paths.push(key.substring(5)) // Remove 'file:' prefix
      }
    }
    return paths
  }

  // Get file content
  getFileContent(sessionId: string, filePath: string): string {
    const doc = this.docs.get(sessionId)
    if (!doc) return ''

    const key = `file:${filePath}`
    const text = doc.getText(key)
    return text.toString()
  }

  // Update file content
  updateFileContent(sessionId: string, filePath: string, content: string): void {
    const doc = this.docs.get(sessionId)
    if (!doc) return

    const key = `file:${filePath}`
    const text = doc.getText(key)

    // Clear and insert new content
    text.delete(0, text.length)
    text.insert(0, content)
  }

  // Create or update file
  createFile(sessionId: string, filePath: string, content: string = ''): void {
    this.updateFileContent(sessionId, filePath, content)
  }

  // Delete file
  deleteFile(sessionId: string, filePath: string): void {
    const doc = this.docs.get(sessionId)
    if (!doc) return

    const key = `file:${filePath}`
    if (doc.share.has(key)) {
      // Remove from shared types
      doc.getText(key).delete(0, doc.getText(key).length)
    }
  }
}

export const yjsManager = new YjsDocumentManager()

// ─────────────────────────────────────────────────────────────
// 2. Diff Utilities
// ─────────────────────────────────────────────────────────────

export interface Diff {
  filePath: string
  changes: Y.YTextEvent
  timestamp: number
}

export function createDiff(sessionId: string, filePath: string): Diff | null {
  const doc = yjsManager.getDocument(sessionId)
  const key = `file:${filePath}`
  const text = doc.getText(key)

  // This is a simplified diff creation
  // In practice, yjs handles this internally
  return {
    filePath,
    changes: text as any, // Y.YTextEvent
    timestamp: Date.now()
  }
}

// ─────────────────────────────────────────────────────────────
// 3. State Snapshot
// ─────────────────────────────────────────────────────────────

export function getSessionSnapshot(sessionId: string): Record<string, string> {
  const doc = yjsManager.getDocument(sessionId)
  const snapshot: Record<string, string> = {}

  const keys = doc.share.keys()
  for (const key of keys) {
    if (key.startsWith('file:')) {
      const filePath = key.substring(5)
      const text = doc.getText(key)
      snapshot[filePath] = text.toString()
    }
  }

  return snapshot
}

export function loadSessionSnapshot(sessionId: string, snapshot: Record<string, string>): void {
  const doc = yjsManager.getDocument(sessionId)

  for (const [filePath, content] of Object.entries(snapshot)) {
    const key = `file:${filePath}`
    const text = doc.getText(key)
    text.delete(0, text.length)
    text.insert(0, content)
  }
}
🔌 Collaboration Provider
File: lib/collaboration/provider.ts
typescript
import { yjsManager } from './yjs'
import { Awareness } from 'y-protocols/awareness'

// ─────────────────────────────────────────────────────────────
// 1. Provider Interface
// ─────────────────────────────────────────────────────────────

export interface CollaborationProvider {
  sessionId: string
  userId: string
  userName: string

  connect(): void
  disconnect(): void
  sendDiff(diff: any): void
  sendCursor(cursor: CursorPosition): void
  sendStatus(status: UserStatus): void
  onDiff(callback: (diff: any) => void): void
  onCursor(callback: (userId: string, cursor: CursorPosition) => void): void
  onStatus(callback: (userId: string, status: UserStatus) => void): void
  onUserJoined(callback: (userId: string) => void): void
  onUserLeft(callback: (userId: string) => void): void
  onFileCreated(callback: (path: string, content?: string) => void): void
  onFileDeleted(callback: (path: string) => void): void
  onFileRenamed(callback: (oldPath: string, newPath: string) => void): void
}

// ─────────────────────────────────────────────────────────────
// 2. WebSocket Collaboration Provider
// ─────────────────────────────────────────────────────────────

export class WebSocketCollaborationProvider implements CollaborationProvider {
  private ws: WebSocket | null = null
  private diffCallbacks: ((diff: any) => void)[] = []
  private cursorCallbacks: ((userId: string, cursor: CursorPosition) => void)[] = []
  private statusCallbacks: ((userId: string, status: UserStatus) => void)[] = []
  private userJoinedCallbacks: ((userId: string) => void)[] = []
  private userLeftCallbacks: ((userId: string) => void)[] = []
  private fileCreatedCallbacks: ((path: string, content?: string) => void)[] = []
  private fileDeletedCallbacks: ((path: string) => void)[] = []
  private fileRenamedCallbacks: ((oldPath: string, newPath: string) => void)[] = []

  constructor(
    public sessionId: string,
    public userId: string,
    public userName: string,
    private wsUrl: string
  ) {}

  // ──── Connection ──────────────────────────────────────────

  connect(): void {
    this.ws = new WebSocket(this.wsUrl)

    this.ws.onopen = () => {
      // Send join message
      this.ws?.send(JSON.stringify({
        type: 'join',
        payload: { sessionId: this.sessionId }
      }))
    }

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      this.handleMessage(message)
    }

    this.ws.onclose = () => {
      // Handle reconnection
      this.handleDisconnect()
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.cleanup()
  }

  // ──── Message Handling ────────────────────────────────────

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'diff':
        this.diffCallbacks.forEach(cb => cb(message.payload))
        break

      case 'cursor':
        this.cursorCallbacks.forEach(cb =>
          cb(message.payload.userId, message.payload.position)
        )
        break

      case 'status':
        this.statusCallbacks.forEach(cb =>
          cb(message.payload.userId, message.payload.status)
        )
        break

      case 'user:joined':
        this.userJoinedCallbacks.forEach(cb => cb(message.payload.userId))
        break

      case 'user:left':
        this.userLeftCallbacks.forEach(cb => cb(message.payload.userId))
        break

      case 'file:created':
        this.fileCreatedCallbacks.forEach(cb =>
          cb(message.payload.path, message.payload.content)
        )
        break

      case 'file:deleted':
        this.fileDeletedCallbacks.forEach(cb => cb(message.payload.path))
        break

      case 'file:renamed':
        this.fileRenamedCallbacks.forEach(cb =>
          cb(message.payload.oldPath, message.payload.newPath)
        )
        break

      case 'request:zip':
        // Handle ZIP request from server
        this.handleZipRequest(message.payload)
        break

      case 'request:save':
        // Handle save request from server
        this.handleSaveRequest(message.payload)
        break

      default:
        console.log('Unknown message type:', message.type)
    }
  }

  // ──── Event Handlers ──────────────────────────────────────

  private handleDisconnect(): void {
    // Try to reconnect after delay
    setTimeout(() => {
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect()
      }
    }, 3000)
  }

  private handleZipRequest(payload: { targetUserId: string }): void {
    // Create ZIP of current codebase and send to target user
    // This will be handled by the file system integration
    // We emit an event that the file system can listen to
    window.dispatchEvent(new CustomEvent('request-zip', {
      detail: { targetUserId: payload.targetUserId }
    }))
  }

  private handleSaveRequest(payload: { sessionId: string; closeAfterSave?: boolean }): void {
    // Trigger save flow
    window.dispatchEvent(new CustomEvent('request-save', {
      detail: { sessionId: payload.sessionId, closeAfterSave: payload.closeAfterSave }
    }))
  }

  // ──── Send Methods ────────────────────────────────────────

  sendDiff(diff: any): void {
    this.send('diff', diff)
  }

  sendCursor(cursor: CursorPosition): void {
    this.send('cursor', {
      filePath: cursor.filePath,
      position: { line: cursor.line, column: cursor.column }
    })
  }

  sendStatus(status: UserStatus): void {
    this.send('status', {
      filePath: status.filePath,
      status: status.status
    })
  }

  private send(type: string, payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type,
        payload: {
          sessionId: this.sessionId,
          ...payload
        }
      }))
    }
  }

  // ──── Event Listeners ─────────────────────────────────────

  onDiff(callback: (diff: any) => void): void {
    this.diffCallbacks.push(callback)
  }

  onCursor(callback: (userId: string, cursor: CursorPosition) => void): void {
    this.cursorCallbacks.push(callback)
  }

  onStatus(callback: (userId: string, status: UserStatus) => void): void {
    this.statusCallbacks.push(callback)
  }

  onUserJoined(callback: (userId: string) => void): void {
    this.userJoinedCallbacks.push(callback)
  }

  onUserLeft(callback: (userId: string) => void): void {
    this.userLeftCallbacks.push(callback)
  }

  onFileCreated(callback: (path: string, content?: string) => void): void {
    this.fileCreatedCallbacks.push(callback)
  }

  onFileDeleted(callback: (path: string) => void): void {
    this.fileDeletedCallbacks.push(callback)
  }

  onFileRenamed(callback: (oldPath: string, newPath: string) => void): void {
    this.fileRenamedCallbacks.push(callback)
  }

  // ──── Cleanup ─────────────────────────────────────────────

  private cleanup(): void {
    this.diffCallbacks = []
    this.cursorCallbacks = []
    this.statusCallbacks = []
    this.userJoinedCallbacks = []
    this.userLeftCallbacks = []
    this.fileCreatedCallbacks = []
    this.fileDeletedCallbacks = []
    this.fileRenamedCallbacks = []
  }
}
🎨 Client-Side Integration
File: hooks/useCollaboration.ts
typescript
import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { yjsManager } from '@/lib/collaboration/yjs'
import { WebSocketCollaborationProvider } from '@/lib/collaboration/provider'

interface UseCollaborationOptions {
  sessionId: string
  userId: string
  userName: string
  wsUrl: string
}

interface CursorPosition {
  filePath: string
  line: number
  column: number
}

interface UserStatus {
  filePath: string
  status: 'idle' | 'editing' | 'viewing'
}

export function useCollaboration({ sessionId, userId, userName, wsUrl }: UseCollaborationOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const providerRef = useRef<WebSocketCollaborationProvider | null>(null)
  const docRef = useRef<Y.Doc | null>(null)
  const awarenessRef = useRef<Awareness | null>(null)
  const [otherUsers, setOtherUsers] = useState<Map<string, { name: string; cursor?: CursorPosition; status?: UserStatus }>>(new Map())

  useEffect(() => {
    // Initialize yjs document
    const doc = yjsManager.getDocument(sessionId)
    docRef.current = doc

    // Initialize provider
    const provider = new WebSocketCollaborationProvider(
      sessionId,
      userId,
      userName,
      wsUrl
    )
    providerRef.current = provider

    // Set up awareness
    const awareness = yjsManager.getAwareness(sessionId)
    awarenessRef.current = awareness

    // Set local user
    awareness.setLocalState({
      user: {
        name: userName,
        id: userId
      },
      cursor: null,
      status: null
    })

    // Connect
    provider.connect()

    // Handle awareness updates
    awareness.on('change', () => {
      const states = awareness.getStates()
      const users = new Map()

      for (const [id, state] of states) {
        if (id !== userId) {
          users.set(id, {
            name: state.user?.name || 'Unknown',
            cursor: state.cursor,
            status: state.status
          })
        }
      }

      setOtherUsers(users)
    })

    // Listen for connection status
    provider.onDiff(() => {
      setIsConnected(true)
    })

    return () => {
      provider.disconnect()
      if (docRef.current) {
        docRef.current.destroy()
      }
    }
  }, [sessionId, userId])

  // ──── Methods ─────────────────────────────────────────────

  const getFileText = (filePath: string): Y.Text => {
    return yjsManager.getFileText(sessionId, filePath)
  }

  const updateCursor = (cursor: CursorPosition) => {
    if (awarenessRef.current) {
      awarenessRef.current.setLocalStateField('cursor', cursor)
    }
    if (providerRef.current) {
      providerRef.current.sendCursor(cursor)
    }
  }

  const updateStatus = (status: UserStatus) => {
    if (awarenessRef.current) {
      awarenessRef.current.setLocalStateField('status', status)
    }
    if (providerRef.current) {
      providerRef.current.sendStatus(status)
    }
  }

  const createFile = (path: string, content: string = '') => {
    yjsManager.createFile(sessionId, path, content)
    if (providerRef.current) {
      providerRef.current.sendDiff({
        type: 'file:created',
        path,
        content
      })
    }
  }

  const deleteFile = (path: string) => {
    yjsManager.deleteFile(sessionId, path)
    if (providerRef.current) {
      providerRef.current.sendDiff({
        type: 'file:deleted',
        path
      })
    }
  }

  const renameFile = (oldPath: string, newPath: string) => {
    // Get content from old file
    const content = yjsManager.getFileContent(sessionId, oldPath)

    // Create new file
    yjsManager.createFile(sessionId, newPath, content)

    // Delete old file
    yjsManager.deleteFile(sessionId, oldPath)

    if (providerRef.current) {
      providerRef.current.sendDiff({
        type: 'file:renamed',
        oldPath,
        newPath
      })
    }
  }

  // ──── Event Listeners ─────────────────────────────────────

  const onDiff = (callback: (diff: any) => void) => {
    providerRef.current?.onDiff(callback)
  }

  const onUserJoined = (callback: (userId: string) => void) => {
    providerRef.current?.onUserJoined(callback)
  }

  const onUserLeft = (callback: (userId: string) => void) => {
    providerRef.current?.onUserLeft(callback)
  }

  const onFileCreated = (callback: (path: string, content?: string) => void) => {
    providerRef.current?.onFileCreated(callback)
  }

  const onFileDeleted = (callback: (path: string) => void) => {
    providerRef.current?.onFileDeleted(callback)
  }

  const onFileRenamed = (callback: (oldPath: string, newPath: string) => void) => {
    providerRef.current?.onFileRenamed(callback)
  }

  return {
    isConnected,
    otherUsers,
    getFileText,
    updateCursor,
    updateStatus,
    createFile,
    deleteFile,
    renameFile,
    onDiff,
    onUserJoined,
    onUserLeft,
    onFileCreated,
    onFileDeleted,
    onFileRenamed
  }
}
🔀 Conflict Resolution
GridCore uses yjs CRDT which handles conflicts automatically. Here's how it works:

1. Last-Write-Wins on Same Line
typescript
// When two users edit the same line simultaneously
// yjs handles this automatically
// Both changes are preserved and merged
// The result is a combination of both changes

// Example:
// User A changes line 5 to "const x = 10"
// User B changes line 5 to "let x = 20"
// yjs merges to: "const x = 20" (if both edits are independent)
// or keeps both changes if they're conflicting

// yjs uses a causal ordering to resolve conflicts
// Changes are applied in the order they were made
// This ensures eventual consistency
2. File Creation Conflicts
typescript
// If two users create the same file simultaneously
// The first creation wins
// The second user's creation is ignored but no error is shown

// Implementation in server:
async function handleFileCreate(payload: { sessionId: string; path: string }, userId: string) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  // Check if user can create files
  const isOwner = userId === session.ownerId
  const isTempOwner = userId === session.tempOwnerId

  if (!isOwner && !isTempOwner) {
    sendError(state.connections.get(userId), 'Only owners can create files')
    return
  }

  // Broadcast to all users (including sender)
  // yjs will handle the conflict on each client
  broadcastToSession(payload.sessionId, {
    type: 'file:created',
    payload: {
      userId,
      path: payload.path,
      content: payload.content || ''
    }
  })
}
📊 State Synchronization
Snapshot Flow
text
┌─────────────────────────────────────────────────────────────────────────┐
│                    State Synchronization Flow                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  New User Joins:                                                        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐        │
│  │  Client  │───▶│  Server  │───▶│  Owner   │───▶│  Client  │        │
│  │  (New)   │    │  (Proxy) │    │  (State) │    │  (New)   │        │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘        │
│       ▲               │               │               │               │
│       │               │               │               │               │
│       └───────────────┴───────────────┴───────────────┘               │
│                                                                         │
│  1. New user sends join request                                        │
│  2. Server requests ZIP from owner                                     │
│  3. Owner client creates ZIP and sends to server                       │
│  4. Server forwards ZIP to new user                                    │
│  5. New user extracts ZIP and loads into yjs                           │
│  6. All users sync via yjs                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
Code Implementation
typescript
// Client-side ZIP creation
async function createZipForNewUser(targetUserId: string): Promise<Buffer> {
  // Get all file contents from yjs
  const snapshot = getSessionSnapshot(sessionId)

  // Create ZIP
  const zip = new JSZip()
  for (const [path, content] of Object.entries(snapshot)) {
    zip.file(path, content)
  }

  return await zip.generateAsync({ type: 'nodebuffer' })
}

// Server-side ZIP forwarding
async function handleZipRequest(payload: { targetUserId: string }, userId: string, ws: WebSocket) {
  const session = state.sessions.get(payload.sessionId)
  if (!session) return

  // Request ZIP from user
  const userWs = state.connections.get(userId)
  if (userWs) {
    userWs.send(JSON.stringify({
      type: 'request:zip',
      payload: { targetUserId: payload.targetUserId }
    }))
  }
}

// Client-side ZIP handler
function handleZipRequest(payload: { targetUserId: string }) {
  // Create ZIP
  createZip().then((zipBuffer) => {
    // Send to server
    ws.send(JSON.stringify({
      type: 'send:zip',
      payload: {
        targetUserId: payload.targetUserId,
        zip: zipBuffer.toString('base64')
      }
    }))
  })
}

// Server-side ZIP receiver
function handleSendZip(payload: { targetUserId: string; zip: string }, userId: string) {
  const targetWs = state.connections.get(payload.targetUserId)
  if (targetWs) {
    targetWs.send(JSON.stringify({
      type: 'receive:zip',
      payload: {
        zip: payload.zip
      }
    }))
  }
}

// Client-side ZIP receiver
function handleReceiveZip(payload: { zip: string }) {
  const zipBuffer = Buffer.from(payload.zip, 'base64')
  const files = extractZip(zipBuffer)

  // Load into yjs
  loadFilesIntoYjs(files)
}
🎯 Editor Integration
File: components/editor/Editor.tsx
typescript
'use client'

import { useEffect, useRef } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useCollaboration } from '@/hooks/useCollaboration'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'

export function Editor() {
  const { activeFile, fileContents, updateFileContent } = useFileStore()
  const { cursors, updateCursor } = useEditorStore()
  const editorRef = useRef<any>(null)

  const {
    getFileText,
    updateCursor: updateCollabCursor,
    updateStatus,
    onDiff
  } = useCollaboration({
    sessionId: 'session-id',
    userId: 'user-id',
    userName: 'John Doe',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL!
  })

  // ──── Editor Setup ────────────────────────────────────────

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor

    // Set up cursor change listener
    editor.onDidChangeCursorPosition((e: any) => {
      const position = e.position
      const filePath = activeFile || ''

      // Update local cursor
      updateCursor(filePath, position.lineNumber, position.column)

      // Update collaboration cursor
      updateCollabCursor({
        filePath,
        line: position.lineNumber,
        column: position.column
      })

      // Update status
      updateStatus({
        filePath,
        status: 'editing'
      })
    })

    // Set up focus/blur listeners
    editor.onDidFocusEditorWidget(() => {
      updateStatus({
        filePath: activeFile || '',
        status: 'editing'
      })
    })

    editor.onDidBlurEditorWidget(() => {
      updateStatus({
        filePath: activeFile || '',
        status: 'viewing'
      })
    })
  }

  // ──── Collaboration Handlers ─────────────────────────────

  useEffect(() => {
    if (!activeFile) return

    // Get yjs text for active file
    const text = getFileText(activeFile)

    // Listen for changes from other users
    text.observe((event: any) => {
      // Update local file content
      updateFileContent(activeFile, text.toString())
    })

    // Cleanup
    return () => {
      text.unobserve(() => {})
    }
  }, [activeFile])

  // ──── Render Cursors ──────────────────────────────────────

  const renderCursors = () => {
    // Render other users' cursors in the editor
    // Monaco editor doesn't natively support cursor overlays
    // We'll implement this using decorations
  }

  // ──── Render ──────────────────────────────────────────────

  const handleChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      // Update local state
      updateFileContent(activeFile, value)

      // yjs handles syncing automatically
      // No need to manually send diffs
    }
  }

  return (
    <div className="editor-container relative h-full">
      <MonacoEditor
        height="100%"
        defaultLanguage="plaintext"
        value={activeFile ? fileContents.get(activeFile) || '' : ''}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          theme: 'vs-dark',
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          automaticLayout: true,
          renderWhitespace: 'selection',
          suggest: { showWords: true },
          quickSuggestions: { other: false, comments: false, strings: false },
          fontFamily: 'JetBrains Mono, monospace'
        }}
      />
      {/* Cursor overlays will be rendered here */}
    </div>
  )
}
📊 Performance Optimization
1. Diff Batching
typescript
// Batch multiple diffs before sending
class DiffBatcher {
  private queue: any[] = []
  private timeout: NodeJS.Timeout | null = null
  private readonly batchSize = 10
  private readonly batchDelay = 100 // ms

  add(diff: any): void {
    this.queue.push(diff)

    if (this.queue.length >= this.batchSize) {
      this.flush()
    } else if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), this.batchDelay)
    }
  }

  flush(): void {
    if (this.queue.length === 0) return

    const diffs = [...this.queue]
    this.queue = []
    this.timeout = null

    // Send batched diffs
    this.sendBatch(diffs)
  }

  private sendBatch(diffs: any[]): void {
    // Send all diffs in one message
    ws.send(JSON.stringify({
      type: 'diffs',
      payload: { diffs }
    }))
  }
}
2. Document Size Limits
typescript
// Limit document size to prevent memory issues
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB

function checkDocumentSize(sessionId: string): boolean {
  const snapshot = getSessionSnapshot(sessionId)
  const totalSize = JSON.stringify(snapshot).length

  if (totalSize > MAX_DOCUMENT_SIZE) {
    console.warn(`Session ${sessionId} exceeds size limit`)
    return false
  }

  return true
}
📝 Environment Variables
env
# WebSocket URL
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/websocket

# For production
# NEXT_PUBLIC_WS_URL=wss://your-domain.com/api/websocket
🧪 Testing
File: __tests__/collaboration.test.ts
typescript
import { describe, it, expect } from '@jest/globals'
import { YjsDocumentManager } from '@/lib/collaboration/yjs'

describe('Collaboration', () => {
  it('should create and sync documents', () => {
    const manager = new YjsDocumentManager()
    const sessionId = 'test-session'

    // Create document
    const doc = manager.getDocument(sessionId)
    expect(doc).toBeDefined()

    // Create file
    manager.createFile(sessionId, 'test.txt', 'Hello World')

    // Get content
    const content = manager.getFileContent(sessionId, 'test.txt')
    expect(content).toBe('Hello World')

    // Update file
    manager.updateFileContent(sessionId, 'test.txt', 'Hello World!')
    const updated = manager.getFileContent(sessionId, 'test.txt')
    expect(updated).toBe('Hello World!')
  })
})
Next: Read 04-file-management.md for file system implementation.
```
