'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSession as useAuthSession } from 'next-auth/react'
import { WebSocketClient } from '@/lib/websocket/client'
import {
  applyRemoteUpdate,
  createFile as yjsCreateFile,
  deleteFile as yjsDeleteFile,
  encodeState,
  getFileContent as yjsGetFileContent,
  getSessionSnapshot,
  observeUpdates,
  setFileContent as yjsSetFileContent,
} from '@/lib/collaboration/yjs'
import { createZip } from '@/lib/storage/zip'
import { MAX_ZIP_SIZE, MULTI_TAB_MESSAGE } from '@/lib/constants'
import { useWebSocketStore } from '@/stores/wsStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useEditorStore } from '@/stores/editorStore'
import { useChatStore } from '@/stores/chatStore'
import { useFileStore } from '@/stores/fileStore'
import { useUiStore } from '@/stores/uiStore'
import type { ClientEventPayloads, ClientEventType, ServerEventType } from '@/types/websocket'

interface WebSocketContextValue {
  client: WebSocketClient | null
  /** Active network/session id (changes after session:id-changed). */
  sessionId: string
  /** Stable local yjs/collaboration doc id for this connection. */
  collabSessionId: string
  isConnected: boolean
  send: <T extends ClientEventType>(type: T, payload: ClientEventPayloads[T]) => boolean
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used inside <WebSocketProvider>')
  }
  return context
}

export function WebSocketProvider({
  sessionId,
  children,
}: {
  sessionId: string
  children: ReactNode
}) {
  const clientRef = useRef<WebSocketClient | null>(null)
  const isConnected = useWebSocketStore(state => state.isConnected)
  const [activeSessionId, setActiveSessionId] = useState(sessionId)
  const activeSessionIdRef = useRef(sessionId)

  useEffect(() => {
    activeSessionIdRef.current = sessionId
    setActiveSessionId(sessionId)
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return

    const collabSessionId = sessionId
    const activeId = () => activeSessionIdRef.current

    const url = process.env.NEXT_PUBLIC_WS_URL ?? `ws://${window.location.host}/api/websocket`
    const client = new WebSocketClient({
      url,
      sessionId,
      onOpen: () => useWebSocketStore.getState().setConnected(),
      onClose: () => useWebSocketStore.getState().setDisconnected(),
      onError: message => useWebSocketStore.getState().setError(message),
    })
    clientRef.current = client

    const ws = useWebSocketStore.getState()
    const session = useSessionStore.getState()
    const editor = useEditorStore.getState()
    const chat = useChatStore.getState()
    const ui = useUiStore.getState()

    client.on('session:state', payload => {
      session.setSession(payload)
      session.setUsers(payload.users ?? [])
      session.setIsSaved(payload.isSaved)
      session.setTempOwner(payload.tempOwnerId ?? null)
    })

    client.on('session:saved', () => session.setIsSaved(true))

    client.on('session:id-changed', payload => {
      activeSessionIdRef.current = payload.newSessionId
      setActiveSessionId(payload.newSessionId)
      session.setId(payload.newSessionId)
      ui.notify('Session ID changed — old invite links no longer work', 'info')
      window.history.replaceState(null, '', `/session/${payload.newSessionId}`)
    })

    client.on('session:closed', payload => ui.notify(payload.reason, 'info'))

    client.on('user:joined', payload => {
      session.addUser({
        id: payload.userId,
        name: payload.userName ?? payload.userId,
        color: payload.color,
        isOnline: true,
      })
    })

    client.on('user:left', payload => {
      session.removeUser(payload.userId)
      editor.clearUser(payload.userId)
    })

    client.on('user:status', payload => {
      session.setUserStatus(payload.userId, payload.status as never)
    })

    client.on('user:file', payload => session.setUserFile(payload.userId, payload.filePath))

    client.on('cursor', payload => {
      editor.updateCursor(
        payload.userId,
        { filePath: payload.filePath, ...payload.position },
        session.users.get(payload.userId)?.name
      )
    })

    client.on('file:created', payload => {
      if (payload.userId === useSessionStore.getState().currentUserId) return
      const fileStore = useFileStore.getState()
      if (payload.type === 'folder') {
        fileStore.createFolder(payload.path)
        return
      }
      fileStore.createFile(payload.path, payload.content ?? '')
      yjsCreateFile(collabSessionId, payload.path, payload.content ?? '')
      if (payload.content) {
        yjsSetFileContent(collabSessionId, payload.path, payload.content)
      }
    })

    client.on('file:deleted', payload => {
      if (payload.userId === useSessionStore.getState().currentUserId) return
      const paths = Object.keys(getSessionSnapshot(collabSessionId)).filter(
        p => p === payload.path || p.startsWith(`${payload.path}/`)
      )
      useFileStore.getState().deleteFile(payload.path)
      for (const p of paths.length ? paths : [payload.path]) yjsDeleteFile(collabSessionId, p)
    })

    client.on('file:renamed', payload => {
      if (payload.userId === useSessionStore.getState().currentUserId) return
      const snapshot = getSessionSnapshot(collabSessionId)
      const affectedPaths = Object.keys(snapshot).filter(
        path => path === payload.oldPath || path.startsWith(`${payload.oldPath}/`)
      )

      useFileStore.getState().renameFile(payload.oldPath, payload.newPath)

      for (const path of affectedPaths) {
        const nextPath =
          path === payload.oldPath
            ? payload.newPath
            : `${payload.newPath}${path.slice(payload.oldPath.length)}`
        const content = snapshot[path] ?? ''
        yjsCreateFile(collabSessionId, nextPath, content)
        yjsSetFileContent(collabSessionId, nextPath, content)
        yjsDeleteFile(collabSessionId, path)
      }
    })

    client.on('ownership:granted', payload => {
      session.setTempOwner(payload.userId)
      ui.notify('Temporary ownership granted', 'success')
    })

    client.on('ownership:promoted', payload => {
      if (payload.role === 'temp_owner') {
        session.setTempOwner(useSessionStore.getState().currentUserId)
      }
      ui.notify(payload.message ?? 'Ownership updated', 'info')
    })

    client.on('ownership:revoked', () => {
      session.setTempOwner(null)
      ui.notify('Temporary ownership revoked', 'info')
    })

    client.on('ownership:demoted', () => {
      session.setTempOwner(null)
      ui.notify('Temporary ownership removed', 'info')
    })

    client.on('ownership:transferred', payload => {
      session.setTempOwner(payload.tempOwnerId)
      ui.notify(payload.reason ?? 'Session is now held by a temp owner', 'info')
    })

    client.on('ownership:reclaimed', payload => {
      session.setTempOwner(null)
      ui.notify(payload.reason ?? 'Main owner reconnected', 'info')
    })

    client.on('chat', payload => {
      const selfId = useSessionStore.getState().currentUserId
      chat.addMessage({
        id: `${Date.now()}-${payload.userId}`,
        userId: payload.userId,
        userName: payload.userName ?? session.users.get(payload.userId)?.name ?? 'Unknown',
        content: payload.content,
        timestamp: payload.timestamp,
        isOwn: payload.userId === selfId,
      })
    })

    // New joiner asked for the codebase — we are the one holding it.
    client.on('request:zip', async payload => {
      const snapshot = useFileStore.getState().getTreeMap()
      const blob = await createZip(snapshot)
      if (blob.size > MAX_ZIP_SIZE) {
        ui.notify('Session is too large to hand off', 'error')
        return
      }
      const base64 = await blobToBase64(blob)
      client.send('send:zip', {
        targetUserId: payload.targetUserId,
        zip: base64,
        state: uint8ToBase64(encodeState(collabSessionId)),
      })
    })

    client.on('request:save', async payload => {
      const uiState = useUiStore.getState()
      uiState.setSaving(true)
      try {
        const snapshot = useFileStore.getState().getTreeMap()
        const blob = await createZip(snapshot)

        if (blob.size > MAX_ZIP_SIZE) {
          ui.notify('Session exceeds the 50MB limit', 'error')
          return
        }

        const zip = await blobToBase64(blob)
        const response = await fetch(`/api/sessions/${activeId()}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zip }),
        })

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string }
          ui.notify(body.error ?? 'Save failed', 'error')
          return
        }

        session.setIsSaved(true)
        ui.notify('Session saved', 'success')

        if (payload.closeAfterSave) {
          client.send('session:close', { sessionId: activeId(), save: false })
        }
      } finally {
        useUiStore.getState().setSaving(false)
      }
    })

    client.on('error', payload => {
      ui.notify(payload.error, 'error')
      useWebSocketStore.getState().setError(payload.error)
      if (payload.code === 'MULTI_TAB_BLOCKED' || payload.error === MULTI_TAB_MESSAGE) {
        client.disconnect()
      }
    })

    // New joiner received the codebase — hydrate from the shared yjs state.
    client.on('receive:zip', async payload => {
      try {
        let files: Record<string, string> | null = null
        if (payload.zip) {
          const { extractZip } = await import('@/lib/storage/zip')
          files = (await extractZip(new Blob([base64ToBuffer(payload.zip)]))).files
        }

        // The state update carries full history, so subsequent incremental diffs merge correctly.
        if (payload.state) {
          applyRemoteUpdate(collabSessionId, new Uint8Array(base64ToBuffer(payload.state)))
        } else if (files) {
          const { loadFilesIntoYjs } = await import('@/lib/collaboration/yjs')
          loadFilesIntoYjs(collabSessionId, files)
        }

        useFileStore.getState().loadFromMap(files ?? getSessionSnapshot(collabSessionId))
      } catch {
        ui.notify('Could not load the session codebase', 'error')
      }
    })

    // CRDT sync: forward our own updates, apply everyone else's.
    const stopUpdates = observeUpdates(collabSessionId, (paths, update) => {
      const primary = paths[0]
      if (!primary) return
      client.send('diff', {
        sessionId: activeId(),
        filePath: primary,
        diff: { paths, update: uint8ToBase64(update) },
      })
    })

    client.on('diff', payload => {
      const diff = payload.diff as { update?: string } | undefined
      if (!diff?.update) return
      applyRemoteUpdate(collabSessionId, new Uint8Array(base64ToBuffer(diff.update)))
    })

    ws.setConnecting()
    client.connect()

    return () => {
      stopUpdates()
      client.disconnect()
      clientRef.current = null
      useWebSocketStore.getState().setDisconnected()
    }
  }, [sessionId])

  const value = useMemo<WebSocketContextValue>(
    () => ({
      client: clientRef.current,
      sessionId: activeSessionId,
      collabSessionId: sessionId,
      isConnected,
      send: (type, payload) => clientRef.current?.send(type, payload) ?? false,
    }),
    [activeSessionId, sessionId, isConnected]
  )

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}

export type { ServerEventType }

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** ArrayBuffer rather than Uint8Array so the result is valid as a BlobPart too. */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const buffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buffer)

  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i)
  }

  return buffer
}

async function blobToBase64(blob: Blob): Promise<string> {
  return uint8ToBase64(new Uint8Array(await blob.arrayBuffer()))
}
