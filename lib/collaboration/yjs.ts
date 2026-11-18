import * as Y from 'yjs'
import { MAX_DOCUMENT_SIZE } from '@/lib/constants'

/**
 * yjs is the source of truth for file text (AGENTS.md §8). Every file is a
 * Y.Text at `file:${filePath}` inside one Y.Doc per session. The file tree in
 * fileStore is only a render mirror, refreshed from these observers.
 */

const FILE_PREFIX = 'file:'

type Listener = (path: string, content: string) => void

const docs = new Map<string, Y.Doc>()
const listeners = new Map<string, Set<Listener>>()
/** Y.Text instances we've already bound an observer to, keyed by session+path. */
const observed = new Map<string, Set<Y.Text>>()
const shareWatchers = new Map<string, () => void>()

export function fileKey(path: string): string {
  return `${FILE_PREFIX}${path}`
}

export function getDoc(sessionId: string): Y.Doc {
  let doc = docs.get(sessionId)
  if (!doc) {
    doc = new Y.Doc()
    docs.set(sessionId, doc)
  }
  return doc
}

function observedFor(sessionId: string): Set<Y.Text> {
  let set = observed.get(sessionId)
  if (!set) {
    set = new Set()
    observed.set(sessionId, set)
  }
  return set
}

/**
 * Idempotent: binds the observer the first time a Y.Text is touched, closing
 * over its own path so no reverse lookup is needed.
 */
function ensureObserved(sessionId: string, path: string, text: Y.Text): void {
  const set = observedFor(sessionId)
  if (set.has(text)) return
  set.add(text)

  const emit = () => {
    const content = text.toString()
    for (const listener of listeners.get(sessionId) ?? []) {
      listener(path, content)
    }
  }

  text.observe(emit)
  emit()
}

function getFileText(sessionId: string, path: string): Y.Text {
  const text = getDoc(sessionId).getText(fileKey(path))
  ensureObserved(sessionId, path, text)
  return text
}

export function getFilePaths(sessionId: string): string[] {
  return Array.from(getDoc(sessionId).share.keys())
    .filter(key => key.startsWith(FILE_PREFIX))
    .map(key => key.slice(FILE_PREFIX.length))
}

export function getFileContent(sessionId: string, path: string): string {
  return getFileText(sessionId, path).toString()
}

/**
 * Subscribe to text changes. fileStore mirrors from here, never from a diff
 * message. Returns an unsubscribe function.
 */
export function observeFile(sessionId: string, listener: Listener): () => void {
  let set = listeners.get(sessionId)
  if (!set) {
    set = new Set()
    listeners.set(sessionId, set)
  }
  set.add(listener)

  const bindAll = () => {
    for (const path of getFilePaths(sessionId)) {
      getFileText(sessionId, path)
    }
  }

  bindAll()

  if (!shareWatchers.has(sessionId)) {
    const doc = getDoc(sessionId)
    const onUpdate = () => {
      for (const path of getFilePaths(sessionId)) getFileText(sessionId, path)
    }
    doc.on('update', onUpdate)
    shareWatchers.set(sessionId, () => doc.off('update', onUpdate))
  }

  return () => {
    set.delete(listener)
    if (set.size === 0) {
      listeners.delete(sessionId)
      shareWatchers.get(sessionId)?.()
      shareWatchers.delete(sessionId)
    }
  }
}

/** Replace the whole text — used by imports, renames and the initial load. */
export function setFileContent(sessionId: string, path: string, content: string): void {
  const text = getFileText(sessionId, path)

  getDoc(sessionId).transact(() => {
    text.delete(0, text.length)
    if (content) text.insert(0, content)
  })
}

/** Same-file simultaneous create is first-one-wins, silently (AGENTS.md §6). */
export function createFile(sessionId: string, path: string, content = ''): boolean {
  const text = getFileText(sessionId, path)
  if (text.length > 0) return false

  getDoc(sessionId).transact(() => {
    if (content) text.insert(0, content)
  })

  return true
}

export function deleteFile(sessionId: string, path: string): void {
  const key = fileKey(path)
  const doc = getDoc(sessionId)
  if (!doc.share.has(key)) return
  const text = doc.getText(key)
  doc.transact(() => {
    text.delete(0, text.length)
  })
}

/** Full path -> content snapshot. This is what the owner packages into a ZIP. */
export function getSessionSnapshot(sessionId: string): Record<string, string> {
  const doc = getDoc(sessionId)
  const snapshot: Record<string, string> = {}

  for (const path of getFilePaths(sessionId)) {
    snapshot[path] = doc.getText(fileKey(path)).toString()
  }

  return snapshot
}

export function loadFilesIntoYjs(sessionId: string, files: Record<string, string>): void {
  const doc = getDoc(sessionId)

  doc.transact(() => {
    for (const path of getFilePaths(sessionId)) {
      if (!(path in files)) {
        const text = doc.getText(fileKey(path))
        ensureObserved(sessionId, path, text)
        text.delete(0, text.length)
      }
    }

    for (const [path, content] of Object.entries(files)) {
      const text = doc.getText(fileKey(path))
      ensureObserved(sessionId, path, text)
      text.delete(0, text.length)
      if (content) text.insert(0, content)
    }
  })
}

/**
 * Warn-only ceiling. Returns false when the snapshot would exceed the limit so
 * callers skip the operation — throwing here would lose the user's work.
 */
export function checkDocumentSize(sessionId: string): boolean {
  const size = JSON.stringify(getSessionSnapshot(sessionId)).length

  if (size > MAX_DOCUMENT_SIZE) {
    console.warn(`Session document exceeds ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB, skipping`)
    return false
  }

  return true
}

export function destroyDocument(sessionId: string): void {
  shareWatchers.get(sessionId)?.()
  shareWatchers.delete(sessionId)
  docs.get(sessionId)?.destroy()
  docs.delete(sessionId)
  listeners.delete(sessionId)
  observed.delete(sessionId)
}

// ─────────────────────────────────────────────────────────────
// Update transport
//
// There is no y-websocket server, so CRDT updates travel as opaque payloads
// in the `diff` event. yjs still produces and merges every change — we only
// move bytes, never author diffs by hand (AGENTS.md §13 item 7).
// ─────────────────────────────────────────────────────────────

export const REMOTE_ORIGIN = 'remote'

/** Identity comparison only, so the shared type's generic stays out of the way. */
function keyForType(doc: Y.Doc, type: unknown): string | null {
  for (const [key, sharedType] of doc.share.entries()) {
    if (sharedType === type) return key
  }
  return null
}

/**
 * Fire on every local change with the affected paths. Passing REMOTE_ORIGIN as
 * the transaction origin makes this ignore echoes of our own updates.
 */
export function observeUpdates(
  sessionId: string,
  listener: (paths: string[], update: Uint8Array) => void
): () => void {
  const doc = getDoc(sessionId)

  const handler = (
    update: Uint8Array,
    origin: unknown,
    changedDoc: Y.Doc,
    transaction: Y.Transaction
  ): void => {
    if (origin === REMOTE_ORIGIN) return

    const paths = new Set<string>()
    transaction.changedParentTypes.forEach((_properties, type) => {
      const key = keyForType(changedDoc, type)
      if (key?.startsWith(FILE_PREFIX)) paths.add(key.slice(FILE_PREFIX.length))
    })

    listener(Array.from(paths), update)
  }

  doc.on('update', handler)
  return () => doc.off('update', handler)
}

export function applyRemoteUpdate(sessionId: string, update: Uint8Array): void {
  Y.applyUpdate(getDoc(sessionId), update, REMOTE_ORIGIN)
}

/**
 * Full state, history included. A joining client must be seeded with THIS
 * rather than with independently-typed text: incremental updates only merge
 * into a doc that shares the sender's struct history.
 */
export function encodeState(sessionId: string): Uint8Array {
  return Y.encodeStateAsUpdate(getDoc(sessionId))
}
