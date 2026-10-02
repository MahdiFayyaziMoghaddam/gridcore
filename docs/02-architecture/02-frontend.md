# GridCore - Frontend Architecture

## 📋 Overview

The frontend is built with **Next.js 14 (App Router)** using **React** and **TypeScript**. It follows a **component-based architecture** with **Zustand** for state management. The UI is designed to be **minimal, dark-themed, and VSCode-like** for a familiar developer experience.

---

## 🎨 Design System

### Theme

- **Color Scheme**: Dark theme only
- **Primary Colors**:
  - Background: `#0d1117` (GitHub dark)
  - Surface: `#161b22`
  - Border: `#30363d`
  - Text Primary: `#c9d1d9`
  - Text Secondary: `#8b949e`
  - Accent: `#58a6ff` (blue)
  - Success: `#3fb950` (green)
  - Warning: `#d29922` (yellow)
  - Error: `#f85149` (red)

### Typography

- **Font Family**: `'JetBrains Mono', 'Fira Code', monospace` (editor) + `'Inter', sans-serif` (UI)
- **Font Sizes**:
  - Editor: 14px (configurable)
  - UI: 12px - 16px
- **Line Height**: 1.5 (UI), 1.6 (editor)

### Spacing

- **Unit**: 4px (multiplier)
- **Padding**: 8px, 12px, 16px, 24px
- **Margins**: 8px, 12px, 16px, 24px
- **Gaps**: 8px, 12px, 16px

### Icons

- **Icon Library**: Lucide React (consistent, minimal)
- **File Icons**: Based on file extension (custom mapping)
- **Status Icons**: Simple dots and indicators

---

## 🏗️ Component Hierarchy

```
App (Root Layout)
├── AuthProvider (NextAuth)
├── ThemeProvider (Dark theme)
├── ToastProvider (react-toastify)
└── AppLayout
    ├── Navbar
    │ ├── Logo
    │ ├── SessionName
    │ ├── UserList (avatars)
    │ ├── SessionControls
    │ │ ├── SaveButton
    │ │ ├── ExportButton
    │ │ ├── ImportButton
    │ │ └── CloseButton
    │ └── UserMenu
    │ ├── Profile
    │ ├── Sessions (saved list)
    │ └── Logout
    ├── MainLayout
    │ ├── Sidebar
    │ │ ├── SidebarTabs
    │ │ │ ├── FilesTab
    │ │ │ │ └── FileTree
    │ │ │ │ ├── FileItem (recursive)
    │ │ │ │ └── FolderItem (recursive)
    │ │ │ ├── ChatTab
    │ │ │ │ ├── ChatMessages
    │ │ │ │ │ └── ChatMessage
    │ │ │ │ └── ChatInput
    │ │ │ └── UsersTab
    │ │ │ └── UserListItem
    │ │ └── SidebarResizer
    │ ├── MainContent
    │ │ ├── EditorTabs
    │ │ │ └── EditorTab
    │ │ ├── Editor
    │ │ │ ├── MonacoEditor
    │ │ │ └── CursorOverlay
    │ │ └── EditorStatus
    │ │ ├── LineInfo
    │ │ ├── LanguageInfo
    │ │ └── EncodingInfo
    │ └── StatusBar
    │ ├── SessionInfo
    │ ├── UserCount
    │ └── ConnectionStatus
    └── Modals
    ├── SaveDialog
    ├── ImportDialog
    ├── NewSessionDialog
    └── SessionIdChangeDialog
```

---

## 📦 Zustand Stores

### 1. Session Store (`stores/sessionStore.ts`)

```typescript
interface SessionStore {
  // State
  sessionId: string | null
  sessionName: string
  ownerId: string | null
  tempOwnerId: string | null
  isSaved: boolean
  users: User[]
  isOwner: boolean
  isTempOwner: boolean

  // Actions
  setSession: (session: Session) => void
  setUsers: (users: User[]) => void
  addUser: (user: User) => void
  removeUser: (userId: string) => void
  updateUserStatus: (userId: string, status: UserStatus) => void
  setIsSaved: (saved: boolean) => void
  clearSession: () => void
}
```

### 2. File Store (`stores/fileStore.ts`)

```typescript
interface FileStore {
  // State
  files: FileTree
  openFiles: string[] // paths
  activeFile: string | null // path
  fileContents: Map<string, string>

  // Actions
  loadFiles: (files: FileTree) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  createFile: (path: string, content?: string) => void
  deleteFile: (path: string) => void
  renameFile: (oldPath: string, newPath: string) => void
  getFileContent: (path: string) => string | null
}
```

### 3. Editor Store (`stores/editorStore.ts`)

```typescript
interface EditorStore {
  // State
  cursors: Map<string, CursorPosition>
  selections: Map<string, Selection>
  userStatuses: Map<string, UserStatus>

  // Actions
  updateCursor: (userId: string, position: CursorPosition) => void
  updateSelection: (userId: string, selection: Selection) => void
  updateUserStatus: (userId: string, status: UserStatus) => void
  clearUser: (userId: string) => void
}
```

### 4. Chat Store (`stores/chatStore.ts`)

```typescript
interface ChatStore {
  // State
  messages: ChatMessage[]
  isMuted: boolean

  // Actions
  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  toggleMute: () => void
}
```

### 5. UI Store (`stores/uiStore.ts`)

```typescript
interface UIStore {
  // State
  sidebarWidth: number
  isSidebarOpen: boolean
  activeSidebarTab: 'files' | 'chat' | 'users'
  isSaving: boolean
  isImporting: boolean
  isExporting: boolean
  notifications: Notification[]

  // Actions
  setSidebarWidth: (width: number) => void
  toggleSidebar: () => void
  setActiveSidebarTab: (tab: 'files' | 'chat' | 'users') => void
  setSaving: (saving: boolean) => void
  setImporting: (importing: boolean) => void
  setExporting: (exporting: boolean) => void
  addNotification: (notification: Notification) => void
  removeNotification: (id: string) => void
}
```

## 🔌 Custom Hooks

### 1. useWebSocket (`hooks/useWebSocket.ts`)

```typescript
interface UseWebSocketReturn {
  isConnected: boolean
  connect: (sessionId: string) => void
  disconnect: () => void
  send: (event: string, payload: any) => void
  onEvent: (event: string, callback: (data: any) => void) => void
  offEvent: (event: string, callback: (data: any) => void) => void
}

function useWebSocket(): UseWebSocketReturn {
  // Manages WebSocket connection lifecycle
  // Handles reconnection on disconnect
  // Provides event subscription system
  // Validates JWT token on connection
}
```

### 2. useCollaboration (`hooks/useCollaboration.ts`)

```typescript
interface UseCollaborationReturn {
  ydoc: Y.Doc
  awareness: Awareness
  provider: CollaborationProvider
  onDiff: (callback: (diff: Diff) => void) => void
  sendDiff: (diff: Diff) => void
}

function useCollaboration(sessionId: string): UseCollaborationReturn {
  // Initializes yjs document
  // Sets up awareness (cursor positions)
  // Handles diff generation and application
  // Integrates with WebSocket for diff broadcasting
}
```

### 3. useFileSystem (`hooks/useFileSystem.ts`)

```typescript
interface UseFileSystemReturn {
  files: FileTree
  openFiles: string[]
  activeFile: string | null
  open: (path: string) => void
  close: (path: string) => void
  setActive: (path: string) => void
  create: (path: string, content?: string) => void
  delete: (path: string) => void
  rename: (oldPath: string, newPath: string) => void
  getContent: (path: string) => string
  updateContent: (path: string, content: string) => void
  importZip: (file: File) => Promise<void>
  exportZip: () => Promise<Blob>
}

function useFileSystem(): UseFileSystemReturn {
  // Combines file store with yjs integration
  // Handles file operations with diff generation
  // Manages editor tabs
  // Implements ZIP import/export
}
```

### 4. useSession (`hooks/useSession.ts`)

```typescript
interface UseSessionReturn {
  session: Session | null
  isLoading: boolean
  createSession: (name?: string) => Promise<string>
  joinSession: (sessionId: string) => Promise<void>
  saveSession: () => Promise<void>
  closeSession: () => Promise<void>
  changeSessionId: () => Promise<string>
  grantOwnership: (userId: string) => Promise<void>
  revokeOwnership: () => Promise<void>
  loadSavedSession: (sessionId: string) => Promise<void>
  deleteSavedSession: (sessionId: string) => Promise<void>
}

function useSession(): UseSessionReturn {
  // Manages session lifecycle
  // Handles API calls for session operations
  // Integrates with WebSocket for real-time updates
  // Manages saved sessions list
}
```

### 5. useChat (`hooks/useChat.ts`)

```typescript
interface UseChatReturn {
  messages: ChatMessage[]
  isMuted: boolean
  sendMessage: (content: string) => void
  toggleMute: () => void
  clearMessages: () => void
}

function useChat(): UseChatReturn {
  // Manages chat state
  // Handles message sending with cooldown
  // Integrates with WebSocket for broadcast
  // Implements mute functionality
}
```

### 6. usePresence (`hooks/usePresence.ts`)

```typescript
interface UsePresenceReturn {
  users: User[]
  userStatuses: Map<string, UserStatus>
  currentFile: string | null
  updateStatus: (status: UserStatus) => void
}

function usePresence(): UsePresenceReturn {
  // Manages user presence
  // Tracks current file and status
  // Integrates with WebSocket for broadcast
  // Updates user list
}
```

## 🎨 Component Implementation Guides

### 1. Editor Component (`components/editor/Editor.tsx`)

```typescript
import { MonacoEditor } from '@monaco-editor/react'
import { useEditorStore } from '@/stores/editorStore'

export function Editor() {
  const { activeFile, fileContents } = useFileStore()
  const { cursors, selections } = useEditorStore()

  // Configure Monaco
  const editorOptions = {
    theme: 'vs-dark',
    minimap: { enabled: true },
    fontSize: 14,
    lineNumbers: 'on' as const,
    automaticLayout: true,
    renderWhitespace: 'selection' as const,
    suggest: { showWords: true },
    quickSuggestions: { other: false, comments: false, strings: false },
  }

  // Handle editor changes
  const handleChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      updateFileContent(activeFile, value)
      // Generate and send diff
      sendDiff(activeFile, value)
    }
  }

  // Render cursor overlays
  const renderCursors = () => {
    return Array.from(cursors.entries()).map(([userId, cursor]) => (
      <CursorOverlay key={userId} userId={userId} position={cursor} />
    ))
  }

  return (
    <div className="editor-container">
      <MonacoEditor
        height="100%"
        defaultLanguage="plaintext"
        value={activeFile ? fileContents.get(activeFile) : ''}
        onChange={handleChange}
        options={editorOptions}
      />
      {renderCursors()}
    </div>
  )
}
```

### 2. FileTree Component (`components/editor/FileTree.tsx`)

```typescript
import { useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react'

interface FileTreeProps {
  files: FileTree
  onFileClick: (path: string) => void
  onFileCreate: (path: string) => void
  onFileDelete: (path: string) => void
  onFileRename: (oldPath: string, newPath: string) => void
}

export function FileTree({ files, onFileClick, onFileCreate, onFileDelete, onFileRename }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null)

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderTree = (node: FileTree, path: string = '') => {
    const fullPath = path ? `${path}/${node.name}` : node.name
    const isExpanded = expandedFolders.has(fullPath)

    if (node.type === 'folder') {
      return (
        <div key={fullPath} className="folder-item">
          <div
            className="folder-header"
            onClick={() => toggleFolder(fullPath)}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({ x: e.clientX, y: e.clientY, path: fullPath })
            }}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Folder size={16} />
            <span>{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div className="folder-children">
              {node.children.map(child => renderTree(child, fullPath))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        key={fullPath}
        className="file-item"
        onClick={() => onFileClick(fullPath)}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY, path: fullPath })
        }}
      >
        <FileIcon extension={getFileExtension(node.name)} />
        <span>{node.name}</span>
      </div>
    )
  }

  return (
    <div className="file-tree">
      {files.children?.map(child => renderTree(child))}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={contextMenu.path}
          onClose={() => setContextMenu(null)}
          onCreate={onFileCreate}
          onDelete={onFileDelete}
          onRename={onFileRename}
        />
      )}
    </div>
  )
}
```

### 3. ChatPanel Component (`components/chat/ChatPanel.tsx`)

```typescript
import { useState, useRef, useEffect } from 'react'
import { Send, Volume2, VolumeX } from 'lucide-react'
import { useChat } from '@/hooks/useChat'

export function ChatPanel() {
  const { messages, isMuted, sendMessage, toggleMute } = useChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleSend = () => {
    if (input.trim() && input.length <= 200) {
      sendMessage(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="chat-panel flex flex-col h-full">
      <div className="chat-header flex justify-between items-center p-2 border-b border-border">
        <span className="font-semibold">Chat</span>
        <button onClick={toggleMute} className="p-1 hover:bg-surface-hover rounded">
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      <div className="chat-messages flex-1 overflow-y-auto p-2 space-y-1">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input p-2 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 200))}
            onKeyDown={handleKeyDown}
            placeholder="Type a message (200 char max)..."
            className="flex-1 px-2 py-1 bg-surface border border-border rounded text-sm"
            disabled={isMuted}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isMuted}
            className="px-3 py-1 bg-accent text-white rounded text-sm hover:bg-accent-hover disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-xs text-secondary mt-1">
          {input.length}/200 characters
        </div>
      </div>
    </div>
  )
}
```
User Action → Zustand Store → React Component → WebSocket
                                    ↓
                                Server Broadcast
                                    ↓
                          ┌─────────┴─────────┐
                          ↓                   ↓
                    Zustand Store      React Component
                    (Update State)     (Re-render)
```

### 2. File Edit Flow

```
User Types → Monaco Editor → onChange
    ↓
Get Diff (yjs) → WebSocket Send
    ↓
WebSocket Receive → yjs Apply
    ↓
Update Zustand Store → React Component
    ↓
Monaco Editor Update (re-render)
```

### 3. Presence Flow

```
User Moves Cursor → Editor onCursorChange
    ↓
WebSocket Send (cursor position)
    ↓
WebSocket Receive (all users)
    ↓
Update Zustand Store (cursors map)
    ↓
React Component (CursorOverlay re-render)
```

## 📱 Responsive Behavior

### Desktop (≥ 1024px)

Full layout with sidebar (240px)

All features visible

Monaco editor full width

### Tablet (768px - 1023px)

Collapsible sidebar (icon only)

Monaco editor full width

Chat as modal or bottom sheet

### Mobile (< 768px)

Not fully supported (message: "Desktop only")

Minimal functionality

### Resize Behavior

Sidebar resizable (240px - 480px)

Editor auto-adjusts

Panel collapse/expand

## 🎯 Performance Considerations

### 1. Monaco Editor Optimization

```typescript
// Lazy load Monaco
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  { ssr: false }
)

// Limit language support
const languages = ['javascript', 'typescript', 'python', 'html', 'css', 'json', 'markdown', 'plaintext']
```

### 2. File Tree Virtualization

```typescript
// Use react-window for large file trees
import { FixedSizeList } from 'react-window'

// Render only visible files
const FileTreeVirtualized = ({ files }) => {
  const flattened = flattenFileTree(files)
  return (
    <FixedSizeList
      height={500}
      itemCount={flattened.length}
      itemSize={24}
    >
      {({ index, style }) => (
        <FileItem
          key={flattened[index].path}
          style={style}
          file={flattened[index]}
        />
      )}
    </FixedSizeList>
  )
}
```

### 3. Debouncing

```typescript
// Debounce cursor updates
import { debounce } from 'lodash-es'

const sendCursor = debounce((position) => {
  ws.send('cursor', position)
}, 100)

// Debounce status updates
const updateStatus = debounce((status) => {
  ws.send('status', status)
}, 500)
```

### 4. Memoization

```typescript
// Memoize expensive components
import { memo } from 'react'

const FileItem = memo(({ file, onClick }) => {
  // Component logic
})

// Use useMemo for computed values
const fileTree = useMemo(() => {
  return buildFileTree(files)
}, [files])
```
const updateStatus = debounce((status) => {
  ws.send('status', status)
}, 500)
```

### 4. Memoization

```typescript
// Memoize expensive components
import { memo } from 'react'

const FileItem = memo(({ file, onClick }) => {
  // Component logic
})

// Use useMemo for computed values
const fileTree = useMemo(() => {
  return buildFileTree(files)
}, [files])
```

## 🌐 Internationalization (Future)

### Structure

```
locales/
├── en/
│   ├── common.json
│   ├── auth.json
│   ├── editor.json
│   └── session.json
└── fa/
    ├── common.json
    ├── auth.json
    ├── editor.json
    └── session.json
```

### Usage

```typescript
import { useTranslation } from 'next-i18next'

export function Navbar() {
  const { t } = useTranslation('common')
  return <span>{t('save')}</span>
}
```

## 📝 Customization Points

### 1. Styling Overrides

```typescript
// tailwind.config.ts - Extend as needed
module.exports = {
  theme: {
    extend: {
      colors: {
        // Add custom colors
        'gridcore-bg': '#0d1117',
        'gridcore-surface': '#161b22',
        // ...
      }
    }
  }
}
```

### 2. Editor Configuration

```typescript
// lib/editor/config.ts
export const EDITOR_CONFIG = {
  fontSize: 14,
  fontFamily: 'JetBrains Mono, monospace',
  tabSize: 2,
  wordWrap: 'on' as const,
  minimap: { enabled: true },
  // ... extends easily
}
```

### 3. File Icon Mapping

```typescript
// lib/icons/file-icons.ts
export const FILE_ICONS: Record<string, string> = {
  '.ts': 'typescript',
  '.js': 'javascript',
  '.py': 'python',
  '.html': 'html',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
  // ... extensible
}
```

Next: Read [03-backend.md](03-backend.md) for backend architecture details.
