'use client'

import { useEffect } from 'react'
import { useSession as useAuthSession } from 'next-auth/react'
import { destroyDocument } from '@/lib/collaboration/yjs'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { UserList } from '@/components/collaboration/UserList'
import { Editor } from '@/components/editor/Editor'
import { EditorTabs } from '@/components/editor/EditorTabs'
import { FileTree } from '@/components/editor/FileTree'
import { Navbar, NavbarLogo, NavbarSection } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { StatusBar } from '@/components/layout/StatusBar'
import { SessionControls } from '@/components/session/SessionControls'
import { CopyButton } from '@/components/session/CopyButton'
import { useCollaboration } from '@/hooks/useCollaboration'
import { useFileSystem } from '@/hooks/useFileSystem'
import { usePermissions } from '@/hooks/usePermissions'
import { useTabGuard } from '@/hooks/useTabGuard'
import { WebSocketProvider } from '@/hooks/useWebSocket'
import { useChatStore } from '@/stores/chatStore'
import { useEditorStore } from '@/stores/editorStore'
import { useFileStore } from '@/stores/fileStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useUiStore } from '@/stores/uiStore'
import { useWebSocketStore } from '@/stores/wsStore'
import { MULTI_TAB_MESSAGE } from '@/lib/constants'

export function SessionWorkspace({ sessionId }: { sessionId: string }) {
  const { data: authSession } = useAuthSession()
  const setCurrentUser = useSessionStore(state => state.setCurrentUser)
  const currentSessionId = useSessionStore(state => state.sessionId)
  const sessionName = useSessionStore(state => state.name)
  const lastError = useWebSocketStore(state => state.lastError)
  const activeTab = useUiStore(state => state.activeSidebarTab)

  useEffect(() => {
    if (authSession?.user?.id) {
      setCurrentUser(authSession.user.id)
    }
  }, [authSession?.user?.id, setCurrentUser])

  // The session id from the URL is the truth on first paint.
  useEffect(() => {
    const store = useSessionStore.getState()
    if (!store.sessionId) store.setId(sessionId)
  }, [sessionId])

  useEffect(() => {
    return () => {
      destroyDocument(sessionId)
      useFileStore.getState().reset()
      useChatStore.getState().clearMessages()
      useEditorStore.getState().clearAll()
    }
  }, [sessionId])

  const { blocked, reason } = useTabGuard()

  if (blocked || lastError === MULTI_TAB_MESSAGE) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm space-y-2 text-center">
          <h1 className="text-lg font-semibold">{reason ?? MULTI_TAB_MESSAGE}</h1>
          <p className="text-sm text-muted">Close the other GridCore tab, then reload this page.</p>
        </div>
      </main>
    )
  }

  const activeSessionId = currentSessionId ?? sessionId

  return (
    <WebSocketProvider sessionId={sessionId}>
      <WorkspaceInner sessionId={activeSessionId} name={sessionName} activeTab={activeTab} />
    </WebSocketProvider>
  )
}

function WorkspaceInner({
  sessionId,
  name,
  activeTab,
}: {
  sessionId: string
  name: string
  activeTab: 'files' | 'chat' | 'users'
}) {
  const fileSystem = useFileSystem()
  const permissions = usePermissions()
  const { sendCursor } = useCollaboration()

  return (
    <>
      <Navbar>
        <NavbarLogo />
        <span className="truncate text-sm text-muted">{name}</span>
        <CopyButton value={sessionId} />
        <NavbarSection className="ml-auto">
          <SessionControls />
        </NavbarSection>
      </Navbar>

      <div className="flex min-h-0 flex-1">
        <Sidebar>
          {activeTab === 'files' && (
            <FileTree
              files={fileSystem.files}
              activeFile={fileSystem.activeFile}
              canEdit={permissions.canCreateFile}
              onOpen={fileSystem.open}
              onCreate={fileSystem.create}
              onCreateFolder={fileSystem.createFolder}
              onRename={fileSystem.rename}
              onDelete={fileSystem.remove}
            />
          )}
          {activeTab === 'chat' && <ChatPanel />}
          {activeTab === 'users' && <UserList />}
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <EditorTabs />

          {fileSystem.activeFile ? (
            <div className="min-h-0 flex-1">
              <Editor
                path={fileSystem.activeFile}
                onChange={content => fileSystem.updateContent(fileSystem.activeFile!, content)}
                onCursor={(line, column) => sendCursor(fileSystem.activeFile!, line, column)}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">
              Select a file to start editing, or import a ZIP.
            </div>
          )}

          <StatusBar />
        </div>
      </div>
    </>
  )
}
