# GridCore - UI Layout

## 📋 Overview

This document defines the overall UI layout for GridCore. The design is inspired by **VSCode** with a **dark theme** and **minimalist** approach. The layout consists of a navbar, sidebar with tabs, main content area (editor), and status bar.

---

## 🏗️ Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Navbar (40px) │
│ ┌──────┐ ┌──────────┐ ┌──────────────┐ ┌──────┐ ┌──────┐ ┌────────┐ │
│ │ Logo │ │ Session │ │ User Avatars │ │ Save │ │ Export│ │ User │ │
│ │ │ │ Name │ │ │ │ │ │ │ │ Menu │ │
│ └──────┘ └──────────┘ └──────────────┘ └──────┘ └──────┘ └────────┘ │
├──────────┬──────────────────────────────────────────────────────────────┤
│ │ │
│ Sidebar │ Main Content Area │
│ (240px) │ │
│ │ ┌────────────────────────────────────────────────────────┐ │
│ ┌──────┐ │ │ Editor Tabs │ │
│ │Files │ │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │ │
│ │ ├── │ │ │ file1 │ │ file2 │ │ file3 │ │ + │ │ │
│ │ │src │ │ └──────┘ └──────┘ └──────┘ └──────┘ │ │
│ │ │ ├─ │ │ │ │
│ │ │ │ │ │ ┌────────────────────────────────────────────────────┐ │ │
│ │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ Monaco Editor │ │ │
│ │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ │ │ │ │
│ │ │ │ │ │ └────────────────────────────────────────────────────┘ │ │
│ │ │ │ │ │ │ │
│ │ │ │ │ │ ┌────────────────────────────────────────────────────┐ │ │
│ │ │ │ │ │ │ Chat / Output Panel │ │ │
│ │ │ │ │ │ └────────────────────────────────────────────────────┘ │ │
│ │ │ │ │ │
│ │ ├── │ │ │ │
│ │ │ │ │ │
│ │ Chat │ │ │ │
│ │ │ │ │ │
│ │ Users │ │ │ │
│ └──────┘ │ │ │
│ │ │ │
├──────────┴──────────────────────────────────────────────────────────────┤
│ Status Bar (24px) │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│ │ Session │ │ User │ │ Language │ │ Line/Col │ │ Connection │ │
│ │ ID │ │ Count │ │ │ │ │ │ Status │ │
```

---
```

---

## 🎨 Design System

### Colors (Dark Theme)

```css
:root {
  /* Backgrounds */
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-surface: #1c2333;
  --bg-surface-hover: #252d3f;
  --bg-active: #2d3748;

  /* Borders */
  --border: #30363d;
  --border-active: #58a6ff;

  /* Text */
  --text-primary: #c9d1d9;
  --text-secondary: #8b949e;
  --text-muted: #484f58;

  /* Accents */
  --accent: #58a6ff;
  --accent-hover: #79c0ff;
  --accent-active: #1f6feb;

  /* Status */
  --success: #3fb950;
  --warning: #d29922;
  --error: #f85149;
  --info: #58a6ff;

  /* Editor */
  --editor-bg: #0d1117;
  --editor-line-highlight: #161b22;
  --editor-selection: #264f78;
  --editor-cursor: #58a6ff;

  /* Sidebar */
  --sidebar-bg: #0d1117;
  --sidebar-active: #161b22;
  --sidebar-hover: #1c2333;
}
Typography
css
/* Fonts */
:root {
  --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-editor: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

  /* Sizes */
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-lg: 16px;
  --text-xl: 20px;

  /* Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}

/* Editor Font */
.editor-content {
  font-family: var(--font-editor);
  font-size: 14px;
  line-height: 1.6;
}
Spacing
css
:root {
  /* Base unit: 4px */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
📐 Layout Components
1. Navbar
typescript
// components/layout/Navbar.tsx

interface NavbarProps {
  sessionName?: string
  userCount?: number
  isOwner?: boolean
  isTempOwner?: boolean
  onSave?: () => void
  onExport?: () => void
  onClose?: () => void
}

export function Navbar({
  sessionName,
  userCount,
  isOwner,
  isTempOwner,
  onSave,
  onExport,
  onClose
}: NavbarProps) {
  return (
    <nav className="navbar flex items-center justify-between h-10 px-3 bg-secondary border-b border-border">
      {/* Left: Logo + Session Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Logo size={20} />
          <span className="font-semibold text-sm">GridCore</span>
        </div>

        {sessionName && (
          <>
            <span className="text-muted">/</span>
            <span className="text-sm text-secondary">{sessionName}</span>
          </>
        )}
      </div>

      {/* Center: User Avatars */}
      <div className="flex items-center gap-1">
        <UserAvatars count={userCount || 0} />
        {userCount && userCount > 0 && (
          <span className="text-xs text-muted ml-1">{userCount}</span>
        )}
      </div>

      {/* Right: Controls + User Menu */}
      <div className="flex items-center gap-1">
        {/* Owner Controls */}
        {(isOwner || isTempOwner) && (
          <>
            {isOwner && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onSave}
                className="h-7 px-2 text-xs"
              >
                <Save size={14} className="mr-1" />
                Save
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={onExport}
              className="h-7 px-2 text-xs"
            >
              <Download size={14} className="mr-1" />
              Export
            </Button>
          </>
        )}

        {/* Owner Only Controls */}
        {isOwner && <OwnerControls />}

        {/* User Menu */}
        <UserMenu />
      </div>
    </nav>
  )
}
2. Sidebar
typescript
// components/layout/Sidebar.tsx

interface SidebarProps {
  width: number
  onResize: (width: number) => void
  activeTab: 'files' | 'chat' | 'users'
  onTabChange: (tab: 'files' | 'chat' | 'users') => void
}

export function Sidebar({ width, onResize, activeTab, onTabChange }: SidebarProps) {
  return (
    <div
      className="sidebar flex flex-col bg-sidebar border-r border-border"
      style={{ width: `${width}px` }}
    >
      {/* Tab Headers */}
      <div className="flex border-b border-border">
        <TabButton
          active={activeTab === 'files'}
          onClick={() => onTabChange('files')}
          icon={<FolderIcon size={16} />}
          label="Files"
        />
        <TabButton
          active={activeTab === 'chat'}
          onClick={() => onTabChange('chat')}
          icon={<ChatIcon size={16} />}
          label="Chat"
          badge={unreadCount}
        />
        <TabButton
          active={activeTab === 'users'}
          onClick={() => onTabChange('users')}
          icon={<UsersIcon size={16} />}
          label="Users"
          badge={onlineCount}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && <FileTree />}
        {activeTab === 'chat' && <ChatPanel />}
        {activeTab === 'users' && <UserList />}
      </div>

      {/* Resize Handle */}
      <div
        className="resize-handle absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent"
        onMouseDown={handleResize}
      />
    </div>
  )
}
3. Main Content
typescript
// components/layout/MainContent.tsx

export function MainContent() {
  const { openFiles, activeFile, closeFile, setActiveFile } = useFileStore()
  const { isConnected } = useWebSocket()

  return (
    <div className="main-content flex-1 flex flex-col bg-editor-bg">
      {/* Editor Tabs */}
      <div className="editor-tabs flex items-center bg-secondary border-b border-border h-9">
        {openFiles.map((path) => (
          <EditorTab
            key={path}
            path={path}
            isActive={path === activeFile}
            onClick={() => setActiveFile(path)}
            onClose={() => closeFile(path)}
          />
        ))}
        <button
          className="h-full px-2 hover:bg-surface-hover text-muted"
          onClick={() => handleNewFile()}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        {openFiles.length === 0 ? (
          <EmptyState />
        ) : (
          <Editor />
        )}

        {/* Cursor Overlay */}
        <CursorOverlay />
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  )
}
4. Status Bar
typescript
// components/layout/StatusBar.tsx

export function StatusBar() {
  const { activeFile } = useFileStore()
  const { isConnected } = useWebSocket()
  const { sessionId, userCount } = useSession()
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 })

  return (
    <div className="status-bar flex items-center justify-between h-6 px-3 bg-secondary border-t border-border text-xs text-secondary">
      {/* Left */}
      <div className="flex items-center gap-3">
        {/* Session Info */}
        {sessionId && (
          <span className="flex items-center gap-1">
            <span className="text-muted">Session:</span>
            <span className="font-mono">{sessionId.slice(0, 8)}</span>
          </span>
        )}

        {/* User Count */}
        <span className="flex items-center gap-1">
          <Users size={12} />
          <span>{userCount || 0}</span>
        </span>
      </div>

      {/* Center */}
      <div className="flex items-center gap-2">
        {/* Language */}
        {activeFile && (
          <span>{getLanguage(activeFile)}</span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Line/Column */}
        {activeFile && (
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.col}
          </span>
        )}

        {/* Connection Status */}
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-success' : 'bg-error'
          }`} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </span>
      </div>
    </div>
  )
}
📱 Responsive Behavior
Breakpoints
css
/* Tailwind breakpoints */
sm: 640px   /* Mobile */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large Desktop */
2xl: 1536px /* Extra Large */
Layout Adjustments
typescript
// hooks/useResponsive.ts

export function useResponsive() {
  const [isDesktop, setIsDesktop] = useState(true)
  const [isTablet, setIsTablet] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      setIsDesktop(width >= 1024)
      setIsTablet(width >= 768 && width < 1024)
      setIsMobile(width < 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return { isDesktop, isTablet, isMobile }
}
Mobile View (Future)
typescript
// Mobile responsive layout
function MobileLayout() {
  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-2 bg-secondary border-b border-border">
        <Logo size={20} />
        <span className="text-sm font-semibold">GridCore</span>
        <div className="flex items-center gap-1">
          <UserMenu />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Show only editor on mobile */}
        <Editor />
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-around p-2 bg-secondary border-t border-border">
        <NavButton icon={<FolderIcon />} label="Files" />
        <NavButton icon={<ChatIcon />} label="Chat" badge={unreadCount} />
        <NavButton icon={<UsersIcon />} label="Users" badge={onlineCount} />
        <NavButton icon={<SettingsIcon />} label="Settings" />
      </div>
    </div>
  )
}
🎯 Accessibility
ARIA Labels
typescript
// Ensure all interactive elements have ARIA labels
<button aria-label="Save session" onClick={onSave}>
  <Save size={16} />
</button>

<nav role="navigation" aria-label="Main navigation">
  {/* Navbar content */}
</nav>

<aside role="complementary" aria-label="Sidebar">
  {/* Sidebar content */}
</aside>

<main role="main" aria-label="Editor content">
  {/* Editor content */}
</main>
Keyboard Navigation
typescript
// lib/keyboard-shortcuts.ts
export const keyboardShortcuts = {
  save: ['cmd+s', 'ctrl+s'],
  find: ['cmd+f', 'ctrl+f'],
  replace: ['cmd+h', 'ctrl+h'],
  toggleSidebar: ['cmd+b', 'ctrl+b'],
  closeFile: ['cmd+w', 'ctrl+w'],
  switchTab: ['cmd+1', 'cmd+2', 'cmd+3'],
}
📊 Layout Configuration
File: lib/layout-config.ts
typescript
export const layoutConfig = {
  navbarHeight: 40,
  sidebarWidth: 240,
  sidebarMinWidth: 180,
  sidebarMaxWidth: 400,
  statusBarHeight: 24,
  editorTabHeight: 36,

  defaultSidebarTab: 'files' as const,

  // Breakpoints
  breakpoints: {
    mobile: 640,
    tablet: 768,
    desktop: 1024,
  },
}
🧪 Testing Layout
File: __tests__/layout.test.tsx
typescript
import { render, screen } from '@testing-library/react'
import { Layout } from '@/components/layout/Layout'

describe('Layout', () => {
  it('should render navbar', () => {
    render(<Layout />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('should render sidebar', () => {
    render(<Layout />)
    expect(screen.getByRole('complementary')).toBeInTheDocument()
  })

  it('should render main content', () => {
    render(<Layout />)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})
Next: Read 02-components.md for detailed component documentation.

```
