# GridCore - UI Components

## 📋 Overview

This document defines all UI components used in GridCore. Components follow the **Shadcn UI** patterns with **Tailwind CSS** for styling. Each component is designed to be reusable, accessible, and composable.

---

## 🏗️ Component Hierarchy

```text
components/
├── ui/ # Shadcn UI Components (Base)
│ ├── alert.tsx
│ ├── avatar.tsx
│ ├── button.tsx
│ ├── card.tsx
│ ├── dialog.tsx
│ ├── dropdown-menu.tsx
│ ├── input.tsx
│ ├── scroll-area.tsx
│ ├── select.tsx
│ ├── toast.tsx
│ └── index.ts
│
├── layout/ # Layout Components
│ ├── Navbar.tsx
│ ├── Sidebar.tsx
│ ├── StatusBar.tsx
│ └── MainContent.tsx
│
├── editor/ # Editor Components
│ ├── Editor.tsx
│ ├── EditorTabs.tsx
│ ├── FileTree.tsx
│ ├── FileIcon.tsx
│ ├── CursorOverlay.tsx
│ └── index.ts
│
├── collaboration/ # Collaboration Components
│ ├── UserList.tsx
│ ├── UserStatus.tsx
│ ├── UserAvatar.tsx
│ └── index.ts
│
├── chat/ # Chat Components
│ ├── ChatPanel.tsx
│ ├── ChatMessage.tsx
│ ├── ChatInput.tsx
│ ├── NotificationToast.tsx
│ └── index.ts
```
│
├── session/ # Session Components
│ ├── SessionControls.tsx
│ ├── SaveDialog.tsx
│ ├── ImportDialog.tsx
│ ├── ExportButton.tsx
│ ├── OwnerControls.tsx
│ ├── SessionName.tsx
│ └── index.ts
│
└── auth/ # Authentication Components
├── LoginForm.tsx
├── RegisterForm.tsx
├── OAuthButtons.tsx
└── index.ts

text

---

## 🎨 Base UI Components (Shadcn)

### Button

```typescript
// components/ui/button.tsx
import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', isLoading, children, ...props }, ref) => {
    return (
      <button
        className={cn(
          // Base styles
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'disabled:opacity-50 disabled:pointer-events-none',

          // Variants
          {
            'bg-accent text-white hover:bg-accent-hover': variant === 'default',
            'bg-destructive text-white hover:bg-destructive-hover': variant === 'destructive',
            'border border-border bg-transparent hover:bg-surface-hover': variant === 'outline',
            'bg-secondary text-secondary-foreground hover:bg-secondary-hover': variant === 'secondary',
            'hover:bg-surface-hover': variant === 'ghost',
            'text-accent underline-offset-4 hover:underline': variant === 'link',
          },

          // Sizes
          {
            'h-9 px-4 py-2': size === 'default',
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-6': size === 'lg',
            'h-9 w-9': size === 'icon',
          },

          className
        )}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="animate-spin mr-2">⏳</span>
            {children}
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
export { Button }
Input
typescript
// components/ui/input.tsx
import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            'flex h-9 w-full rounded-md border border-border bg-background px-3 py-1',
            'text-sm transition-colors',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-error',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export { Input }
Dialog
typescript
// components/ui/dialog.tsx
import { cn } from '@/lib/utils'
import { ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
}

export function Dialog({ open, onOpenChange, children, className }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onOpenChange(false)
      }}
      ref={overlayRef}
    >
      <div
        className={cn(
          'relative bg-background rounded-lg shadow-lg max-w-lg w-full p-6',
          'animate-in fade-in zoom-in duration-200',
          className
        )}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="mb-4">{children}</div>
}

export function DialogTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>
}

export function DialogDescription({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground mt-1">{children}</p>
}

export function DialogContent({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 mt-4">{children}</div>
}
🏗️ Layout Components
Navbar Component
typescript
// components/layout/Navbar.tsx
import { useState } from 'react'
import { Save, Download, Users, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useSession } from '@/hooks/useSession'
import { useUser } from '@/hooks/useUser'
import { SessionName } from '@/components/session/SessionName'
import { OwnerControls } from '@/components/session/OwnerControls'
import { Logo } from '@/components/ui/logo'

export function Navbar() {
  const { session, isOwner, isTempOwner, saveSession, exportSession } = useSession()
  const { user, users } = useUser()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveSession()
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = async () => {
    try {
      await exportSession()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const userCount = users.size

  return (
    <nav className="navbar flex items-center justify-between h-10 px-3 bg-secondary border-b border-border">
      {/* Left */}
      <div className="flex items-center gap-3">
        <Logo size={20} />
        <span className="font-semibold text-sm hidden sm:block">GridCore</span>

        {session && (
          <>
            <span className="text-muted hidden sm:block">/</span>
            <SessionName name={session.name} />
          </>
        )}
      </div>

      {/* Center */}
      <div className="flex items-center gap-2">
        <div className="flex items-center -space-x-2">
          {Array.from(users.values()).slice(0, 5).map((u) => (
            <UserAvatar key={u.id} user={u} size="sm" />
          ))}
          {userCount > 5 && (
            <span className="text-xs text-muted ml-1">+{userCount - 5}</span>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {(isOwner || isTempOwner) && (
          <>
            {isOwner && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSave}
                disabled={isSaving}
                className="h-7 px-2 text-xs"
              >
                <Save size={14} className="mr-1" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={handleExport}
              className="h-7 px-2 text-xs"
            >
              <Download size={14} className="mr-1" />
              Export
            </Button>
          </>
        )}

        {isOwner && <OwnerControls />}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {user?.name?.slice(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled className="text-muted">
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings size={14} className="mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="text-error">
              <LogOut size={14} className="mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
📝 Editor Components
Editor Component
typescript
// components/editor/Editor.tsx
import { useRef, useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useFileStore } from '@/stores/fileStore'
import { useCollaboration } from '@/hooks/useCollaboration'
import { useEditorStore } from '@/stores/editorStore'
import { CursorOverlay } from './CursorOverlay'

export function Editor() {
  const { activeFile, fileContents, updateFileContent } = useFileStore()
  const { cursors, updateCursor } = useEditorStore()
  const editorRef = useRef<any>(null)

  const { getFileText, updateCursor: updateCollabCursor, updateStatus } = useCollaboration()

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor

    // Cursor position tracking
    editor.onDidChangeCursorPosition((e: any) => {
      const position = e.position
      const filePath = activeFile || ''

      updateCursor(filePath, position.lineNumber, position.column)
      updateCollabCursor({
        filePath,
        line: position.lineNumber,
        column: position.column
      })
    })

    // Editor focus/blur
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

  // Sync with yjs
  useEffect(() => {
    if (!activeFile) return

    const text = getFileText(activeFile)
    text.observe(() => {
      updateFileContent(activeFile, text.toString())
    })

    return () => {
      text.unobserve(() => {})
    }
  }, [activeFile, getFileText, updateFileContent])

  const handleChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      updateFileContent(activeFile, value)
    }
  }

  if (!activeFile) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <File size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No file open</p>
          <p className="text-sm">Select a file from the explorer</p>
        </div>
      </div>
    )
  }

  return (
    <div className="editor-container relative h-full">
      <MonacoEditor
        height="100%"
        defaultLanguage="plaintext"
        value={fileContents.get(activeFile) || ''}
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
      <CursorOverlay editorRef={editorRef} />
    </div>
  )
}
FileTree Component
typescript
// components/editor/FileTree.tsx
import { useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder, Plus } from 'lucide-react'
import { useFileStore } from '@/stores/fileStore'
import { usePermissions } from '@/hooks/usePermissions'
import { FileIcon } from './FileIcon'
import { ContextMenu } from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function FileTree() {
  const { files, openFiles, activeFile, createFile, deleteFile, renameFile } = useFileStore()
  const { canCreateFile, canDeleteFile, canRenameFile } = usePermissions()
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [creatingPath, setCreatingPath] = useState('')
  const [newFileName, setNewFileName] = useState('')

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleCreateFile = (path: string) => {
    setCreatingPath(path)
    setIsCreating(true)
    setNewFileName('')
  }

  const handleCreateConfirm = () => {
    if (newFileName.trim()) {
      const fullPath = creatingPath ? `${creatingPath}/${newFileName}` : newFileName
      createFile(fullPath, '')
      setIsCreating(false)
      setNewFileName('')
    }
  }

  const renderTree = (nodes: any[], path: string = '') => {
    return nodes.map((node) => {
      const fullPath = node.path
      const isExpanded = expandedFolders.has(fullPath)
      const isActive = activeFile === fullPath
      const isOpen = openFiles.includes(fullPath)

      if (node.type === 'folder') {
        return (
          <div key={fullPath} className="folder-item">
            <div
              className="folder-header flex items-center gap-1 px-2 py-1 hover:bg-surface-hover cursor-pointer rounded"
              onClick={() => toggleFolder(fullPath)}
              onContextMenu={(e) => {
                e.preventDefault()
                if (canCreateFile) {
                  setContextMenu({ x: e.clientX, y: e.clientY, path: fullPath })
                }
              }}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Folder size={16} className="text-primary" />
              <span className="text-sm">{node.name}</span>
            </div>

            {isExpanded && node.children && (
              <div className="folder-children ml-4">
                {isCreating && creatingPath === fullPath && (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <File size={16} className="text-muted" />
                    <Input
                      size="sm"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateConfirm()
                        if (e.key === 'Escape') setIsCreating(false)
                      }}
                      autoFocus
                      className="h-6 text-sm"
                      placeholder="filename"
                    />
                    <Button size="sm" variant="ghost" onClick={handleCreateConfirm}>✓</Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>✕</Button>
                  </div>
                )}
                {renderTree(node.children, fullPath)}
              </div>
            )}
          </div>
        )
      }

      return (
        <div
          key={fullPath}
          className={`file-item flex items-center gap-1 px-2 py-1 cursor-pointer rounded ${
            isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-hover'
          }`}
          onClick={() => {
            // Open file logic
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            if (canDeleteFile || canRenameFile) {
              setContextMenu({ x: e.clientX, y: e.clientY, path: fullPath })
            }
          }}
        >
          <FileIcon extension={node.extension || ''} />
          <span className="text-sm">{node.name}</span>
        </div>
      )
    })
  }

  return (
    <div className="file-tree h-full overflow-y-auto">
      <div className="file-tree-header flex justify-between items-center p-2 border-b border-border">
        <span className="font-semibold text-sm">Explorer</span>
        {canCreateFile && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleCreateFile('')}
            className="h-6 w-6 p-0"
          >
            <Plus size={14} />
          </Button>
        )}
      </div>

      <div className="file-tree-content p-1">
        {files.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            <p>No files</p>
            {canCreateFile && (
              <p className="mt-2">Click + to create a file</p>
            )}
          </div>
        ) : (
          renderTree(files)
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={contextMenu.path}
          onClose={() => setContextMenu(null)}
          onCreate={() => handleCreateFile(contextMenu.path)}
          onDelete={() => deleteFile(contextMenu.path)}
          onRename={() => {/* Rename logic */}}
        />
      )}
    </div>
  )
}
💬 Chat Components
ChatPanel Component
typescript
// components/chat/ChatPanel.tsx
import { useState, useRef, useEffect } from 'react'
import { Send, Volume2, VolumeX, MessageCircle } from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface ChatPanelProps {
  sessionId: string
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const { messages, isMuted, unreadCount, sendMessage, toggleMute, resetUnread } = useChat({ sessionId })
  const { user } = useUser()
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isFocused) resetUnread()
  }, [isFocused, resetUnread])

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input.trim())
      setInput('')
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-muted-foreground" />
          <span className="font-semibold text-sm">Chat</span>
          {unreadCount > 0 && !isFocused && (
            <span className="flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium text-white bg-primary rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={toggleMute} className="h-7 w-7 p-0">
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <MessageCircle size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isOwn = msg.userId === user?.id
              return (
                <div key={msg.id} className={cn('flex items-start gap-2', isOwn && 'flex-row-reverse')}>
                  <Avatar className="h-7 w-7 mt-0.5">
                    <AvatarFallback className="text-xs">{getInitials(msg.userName)}</AvatarFallback>
                  </Avatar>
                  <div className={cn('flex flex-col max-w-[80%]', isOwn && 'items-end')}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{isOwn ? 'You' : msg.userName}</span>
                      <span className="text-xs text-muted-foreground">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className={cn(
                      'px-3 py-1.5 rounded-lg text-sm break-words',
                      isOwn ? 'bg-primary text-primary-foreground' : 'bg-surface border border-border'
                    )}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-2 border-t border-border">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 200))}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Type a message (200 char max)..."
            className="flex-1 text-sm"
            maxLength={200}
          />
          <Button size="sm" onClick={handleSend} disabled={!input.trim()} className="h-9 w-9 p-0">
            <Send size={16} />
          </Button>
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>{input.length}/200 characters</span>
          <span>10s cooldown</span>
        </div>
      </div>
    </div>
  )
}
👤 Collaboration Components
UserList Component
typescript
// components/collaboration/UserList.tsx
import { useUserStore } from '@/stores/userStore'
import { useSession } from '@/hooks/useSession'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Users, Circle, File } from 'lucide-react'

export function UserList() {
  const { users, onlineCount } = useUserStore()
  const { isOwner, isTempOwner } = useSession()

  const onlineUsers = Array.from(users.values()).filter(u => u.isOnline)

  const getInitials = (name: string) => {
    return name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-success'
      case 'editing': return 'bg-accent'
      case 'idle': return 'bg-warning'
      case 'away': return 'bg-muted'
      default: return 'bg-muted'
    }
  }

  const getRoleBadge = (userId: string) => {
    if (isOwner(userId)) {
      return <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Owner</span>
    }
    if (isTempOwner(userId)) {
      return <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">Temp</span>
    }
    return null
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <Users size={16} className="text-muted-foreground" />
        <span className="font-semibold text-sm">Users</span>
        <span className="text-xs text-muted-foreground ml-auto">{onlineCount} online</span>
      </div>

      <ScrollArea className="flex-1 p-2">
        {onlineUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Users size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No users online</p>
          </div>
        ) : (
          <div className="space-y-1">
            {onlineUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-2 p-2 rounded hover:bg-surface-hover transition-colors">
                <div className="relative">
                  <Avatar className="h-8 w-8" style={{ backgroundColor: user.color }}>
                    <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <Circle className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-background stroke-background', getStatusColor(user.status))} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{user.name}</span>
                    {getRoleBadge(user.id)}
                  </div>
                  {user.currentFile && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <File size={12} />
                      <span>{user.currentFile}</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground capitalize">{user.status}</div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
🧪 Testing Components
Example Test
typescript
// __tests__/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should handle click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalled()
  })

  it('should show loading state', () => {
    render(<Button isLoading>Loading</Button>)
    expect(screen.getByText('⏳')).toBeInTheDocument()
  })
})
Next: Read 03-routing.md for routing structure documentation.

```
