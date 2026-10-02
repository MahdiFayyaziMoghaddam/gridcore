# GridCore - Folder Structure

## 📋 Overview

This document defines the complete folder structure for the GridCore project. Following this structure ensures consistency, maintainability, and scalability across the codebase.

---

## 🏗️ Complete Structure

```
gridcore/
├── .github/
│ └── workflows/
│ ├── ci.yml
│ └── deploy.yml
│
├── .husky/
│ ├── pre-commit
│ └── pre-push
│
├── .vscode/
│ ├── extensions.json
│ └── settings.json
│
├── app/
│ ├── (auth)/
│ │ ├── login/
│ │ │ └── page.tsx
│ │ ├── register/
│ │ │ └── page.tsx
│ │ └── layout.tsx
│ │
│ ├── (dashboard)/
│ │ ├── session/
│ │ │ ├── [id]/
│ │ │ │ └── page.tsx
│ │ │ ├── join/
│ │ │ │ └── page.tsx
│ │ │ └── new/
│ │ │ └── page.tsx
│ │ ├── sessions/
│ │ │ └── page.tsx
│ │ └── layout.tsx
│ │
│ ├── api/
│ │ ├── auth/
│ │ │ └── [...nextauth]/
│ │ │ └── route.ts
│ │ ├── websocket/
│ │ │ └── route.ts
```
│ │ ├── sessions/
│ │ │ ├── route.ts
│ │ │ ├── [id]/
│ │ │ │ ├── route.ts
│ │ │ │ └── save/
│ │ │ │ └── route.ts
│ │ │ └── check/
│ │ │ └── [id]/
│ │ │ └── route.ts
│ │ └── users/
│ │ └── me/
│ │ └── route.ts
│ │
│ ├── favicon.ico
│ ├── globals.css
│ ├── layout.tsx
│ └── page.tsx
│
├── components/
│ ├── ui/
│ │ ├── alert.tsx
│ │ ├── avatar.tsx
│ │ ├── button.tsx
│ │ ├── card.tsx
│ │ ├── dialog.tsx
│ │ ├── dropdown-menu.tsx
│ │ ├── input.tsx
│ │ ├── scroll-area.tsx
│ │ ├── select.tsx
│ │ ├── toast.tsx
│ │ └── index.ts
│ │
│ ├── layout/
│ │ ├── Navbar.tsx
│ │ ├── Sidebar.tsx
│ │ ├── StatusBar.tsx
│ │ └── MainContent.tsx
│ │
│ ├── editor/
│ │ ├── Editor.tsx
│ │ ├── EditorTabs.tsx
│ │ ├── FileTree.tsx
│ │ ├── FileIcon.tsx
│ │ ├── CursorOverlay.tsx
│ │ └── index.ts
│ │
│ ├── collaboration/
│ │ ├── UserList.tsx
│ │ └── UserStatus.tsx
│ │
│ ├── chat/
│ │ ├── ChatPanel.tsx
│ │ ├── ChatMessage.tsx
│ │ ├── ChatInput.tsx
│ │ └── NotificationToast.tsx
│ │
│ ├── session/
│ │ ├── SessionControls.tsx
│ │ ├── SaveDialog.tsx
│ │ ├── ImportDialog.tsx
│ │ ├── ExportButton.tsx
│ │ ├── OwnerControls.tsx
│ │ └── SessionName.tsx
│ │
│ └── auth/
│ ├── LoginForm.tsx
│ ├── RegisterForm.tsx
│ └── OAuthButtons.tsx
│
├── hooks/
│ ├── useWebSocket.ts
│ ├── useCollaboration.ts
│ ├── useSession.ts
│ ├── useFileSystem.ts
│ ├── useChat.ts
│ ├── usePresence.ts
│ ├── usePermissions.ts
│ ├── useUser.ts
│ └── index.ts
│
├── lib/
│ ├── websocket/
│ │ ├── client.ts
│ │ ├── events.ts
│ │ ├── state.ts
│ │ ├── permissions.ts
│ │ └── types.ts
│ │
│ ├── collaboration/
│ │ ├── yjs.ts
│ │ ├── awareness.ts
│ │ ├── provider.ts
│ │ └── index.ts
│ │
│ ├── file-system/
│ │ ├── helpers.ts
│ │ ├── import.ts
│ │ ├── export.ts
│ │ ├── validation.ts
│ │ ├── security.ts
│ │ └── index.ts
│ │
│ ├── auth/
│ │ ├── nextauth.ts
│ │ ├── password.ts
│ │ └── index.ts
│ │
│ ├── db/
│ │ ├── index.ts
│ │ ├── schema.ts
│ │ ├── queries/
│ │ │ ├── users.ts
│ │ │ ├── sessions.ts
│ │ │ └── auth.ts
│ │ └── migrations/
│ │ ├── 0000_initial.ts
│ │ ├── 0001_add_indexes.ts
│ │ └── ...
│ │
│ ├── storage/
│ │ ├── blob.ts
│ │ ├── zip.ts
│ │ └── index.ts
│ │
│ ├── chat/
│ │ ├── metrics.ts
│ │ └── errors.ts
│ │
│ ├── sound/
│ │ └── index.ts
│ │
│ ├── colors.ts
│ ├── constants.ts
│ ├── utils.ts
│ ├── validators.ts
│ └── index.ts
│
├── stores/
│ ├── sessionStore.ts
│ ├── editorStore.ts
│ ├── fileStore.ts
│ ├── userStore.ts
│ ├── chatStore.ts
│ ├── uiStore.ts
│ └── index.ts
│
├── types/
│ ├── session.ts
│ ├── file.ts
│ ├── user.ts
│ ├── websocket.ts
│ ├── api.ts
│ └── index.ts
│
├── utils/
│ ├── constants.ts
│ ├── helpers.ts
│ ├── validators.ts
│ └── index.ts
│
├── public/
│ ├── sounds/
│ │ ├── chat-notification.mp3
│ │ ├── user-joined.mp3
│ │ └── user-left.mp3
│ ├── images/
│ │ ├── logo.svg
│ │ └── favicon.ico
│ └── fonts/
│ └── ...
│
├── scripts/
│ ├── cleanup-db.ts
│ ├── backup-db.ts
│ ├── validate-env.ts
│ └── seed.ts
│
├── tests/
│ ├── unit/
│ │ ├── file-management.test.ts
│ │ ├── chat.test.ts
│ │ └── ownership.test.ts
│ ├── integration/
│ │ ├── websocket.test.ts
│ │ └── api.test.ts
│ └── e2e/
│ ├── auth.spec.ts
│ ├── session.spec.ts
│ └── collaboration.spec.ts
│
├── .env.example
├── .env.local
├── .env.production
├── .env.staging
├── .env.test
├── .eslintrc.json
├── .gitignore
├── .prettierrc
├── drizzle.config.ts
├── middleware.ts
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── vercel.json

text

---

## 📁 Directory Descriptions

### 1. `app/` - Next.js App Router

The main application entry point with all routes.

```typescript
app/
├── (auth)/              # Authentication routes (login, register)
├── (dashboard)/         # Main app routes (session, sessions)
├── api/                 # API routes (backend endpoints)
│   ├── auth/            # NextAuth authentication
│   ├── websocket/       # WebSocket server
│   ├── sessions/        # Session management APIs
│   └── users/           # User management APIs
├── globals.css          # Global styles
├── layout.tsx           # Root layout
└── page.tsx             # Landing page
Key Files:

layout.tsx: Root layout with providers

(dashboard)/layout.tsx: Main app layout (navbar, sidebar)

api/websocket/route.ts: WebSocket server implementation

2. components/ - React Components
Reusable React components organized by feature.

typescript
components/
├── ui/                  # Shadcn UI components (auto-generated)
├── layout/              # Layout components
│   ├── Navbar.tsx       # Top navigation bar
│   ├── Sidebar.tsx      # Left sidebar (tabs: Files, Chat, Users)
│   ├── StatusBar.tsx    # Bottom status bar
│   └── MainContent.tsx  # Main content area
├── editor/              # Editor components
│   ├── Editor.tsx       # Monaco editor wrapper
│   ├── EditorTabs.tsx   # Open file tabs
│   ├── FileTree.tsx     # File explorer tree
│   ├── FileIcon.tsx     # File icon based on extension
│   └── CursorOverlay.tsx # Remote cursor overlays
├── collaboration/       # Collaboration components
│   ├── UserList.tsx     # List of online users
│   └── UserStatus.tsx   # User status indicator
├── chat/                # Chat components
│   ├── ChatPanel.tsx    # Full chat panel
│   ├── ChatMessage.tsx  # Individual message
│   ├── ChatInput.tsx    # Message input with cooldown
│   └── NotificationToast.tsx # Toast notifications
├── session/             # Session management
│   ├── SessionControls.tsx # Save, export, close buttons
│   ├── SaveDialog.tsx   # Save confirmation dialog
│   ├── ImportDialog.tsx # ZIP import dialog
│   ├── ExportButton.tsx # Export button
│   ├── OwnerControls.tsx # Owner-only controls
│   └── SessionName.tsx  # Session name display/editor
└── auth/                # Authentication components
    ├── LoginForm.tsx    # Login form
    ├── RegisterForm.tsx # Registration form
    └── OAuthButtons.tsx # OAuth provider buttons
3. hooks/ - Custom React Hooks
Reusable custom hooks for business logic.

typescript
hooks/
├── useWebSocket.ts      # WebSocket connection management
├── useCollaboration.ts  # yjs collaboration integration
├── useSession.ts        # Session lifecycle management
├── useFileSystem.ts     # File operations (create, delete, etc.)
├── useChat.ts           # Chat functionality
├── usePresence.ts       # User presence (cursor, status)
├── usePermissions.ts    # Permission checking
├── useUser.ts           # User data and authentication
└── index.ts             # Export all hooks
4. lib/ - Core Libraries
Core business logic and utilities.

typescript
lib/
├── websocket/           # WebSocket client logic
│   ├── client.ts        # WebSocket client class
│   ├── events.ts        # Event definitions
│   ├── state.ts         # In-memory state management
│   ├── permissions.ts   # Permission checking
│   └── types.ts         # TypeScript types
│
├── collaboration/       # yjs integration
│   ├── yjs.ts           # yjs document management
│   ├── awareness.ts     # yjs awareness (cursor, presence)
│   ├── provider.ts      # WebSocket provider for yjs
│   └── index.ts         # Export
│
├── file-system/         # File operations
│   ├── helpers.ts       # File tree manipulation
│   ├── import.ts        # ZIP import logic
│   ├── export.ts        # ZIP export logic
│   ├── validation.ts    # File validation
│   ├── security.ts      # Security checks
│   └── index.ts         # Export
│
├── auth/                # Authentication
│   ├── nextauth.ts      # NextAuth configuration
│   ├── password.ts      # Password hashing/validation
│   └── index.ts         # Export
│
├── db/                  # Database
│   ├── index.ts         # Database client
│   ├── schema.ts        # Drizzle schema
│   ├── queries/         # Database queries
│   │   ├── users.ts     # User queries
│   │   ├── sessions.ts  # Session queries
│   │   └── auth.ts      # Authentication queries
│   └── migrations/      # Drizzle migrations
│
├── storage/             # Storage
│   ├── blob.ts          # Vercel Blob Storage
│   ├── zip.ts           # ZIP utilities
│   └── index.ts         # Export
│
├── chat/                # Chat
│   ├── metrics.ts       # Chat metrics
│   └── errors.ts        # Chat error definitions
│
├── sound/               # Sound
│   └── index.ts         # Sound management
│
├── colors.ts            # Color utilities
├── constants.ts         # Global constants
├── utils.ts             # General utilities
├── validators.ts        # Validation functions
└── index.ts             # Export all libs
5. stores/ - Zustand Stores
State management with Zustand.

typescript
stores/
├── sessionStore.ts      # Session state (sessionId, name, users)
├── editorStore.ts       # Editor state (cursors, selections)
├── fileStore.ts         # File state (files, open files, content)
├── userStore.ts         # User state (current user, user list)
├── chatStore.ts         # Chat state (messages, mute)
├── uiStore.ts           # UI state (sidebar, dialogs, notifications)
└── index.ts             # Export all stores
6. types/ - TypeScript Types
Global TypeScript type definitions.

typescript
types/
├── session.ts           # Session types
├── file.ts              # File and file tree types
├── user.ts              # User and presence types
├── websocket.ts         # WebSocket message types
├── api.ts               # API response types
└── index.ts             # Export all types
7. utils/ - Utilities
General utility functions.

typescript
utils/
├── constants.ts         # Application constants
├── helpers.ts           # Helper functions
├── validators.ts        # Validation utilities
└── index.ts             # Export all utilities
8. public/ - Static Assets
Static files served by Next.js.

typescript
public/
├── sounds/
│   ├── chat-notification.mp3
│   ├── user-joined.mp3
│   └── user-left.mp3
├── images/
│   ├── logo.svg
│   └── favicon.ico
└── fonts/
    └── ...
9. scripts/ - Development Scripts
Utility scripts for development and maintenance.

typescript
scripts/
├── cleanup-db.ts        # Clean up database
├── backup-db.ts         # Backup database
├── validate-env.ts      # Validate environment variables
└── seed.ts              # Seed database with test data
10. __tests__/ - Tests
Test files organized by type.

typescript
__tests__/
├── unit/                # Unit tests
│   ├── file-management.test.ts
│   ├── chat.test.ts
│   └── ownership.test.ts
├── integration/         # Integration tests
│   ├── websocket.test.ts
│   └── api.test.ts
└── e2e/                 # End-to-end tests
    ├── auth.spec.ts
    ├── session.spec.ts
    └── collaboration.spec.ts
📦 Configuration Files
File	Purpose
.env.example	Environment variables template
.env.local	Local environment variables (gitignored)
.eslintrc.json	ESLint configuration
.gitignore	Git ignore rules
.prettierrc	Prettier configuration
drizzle.config.ts	Drizzle ORM configuration
middleware.ts	Next.js middleware (auth)
next.config.js	Next.js configuration
package.json	Dependencies and scripts
tailwind.config.ts	Tailwind CSS configuration
tsconfig.json	TypeScript configuration
vercel.json	Vercel deployment configuration
📝 File Naming Conventions
Components
PascalCase: FileTree.tsx, ChatPanel.tsx

Index file: index.ts for exporting

Hooks
camelCase: useWebSocket.ts, useSession.ts

Prefix: Always start with use

Stores
camelCase: sessionStore.ts, fileStore.ts

Suffix: Always end with Store

Types
PascalCase: Session.ts, User.ts

Interface: IUser or User (prefer User)

Utilities
camelCase: helpers.ts, validators.ts

Configuration
kebab-case: drizzle.config.ts, tailwind.config.ts

📊 Import Guidelines
typescript
// ✅ Good: Use absolute imports
import { useSession } from '@/hooks/useSession'
import { Button } from '@/components/ui/button'
import { SessionStore } from '@/stores/sessionStore'

// ❌ Bad: Relative imports for deep files
import { useSession } from '../../../hooks/useSession'

// ✅ Good: Group imports
import { useSession, useUser } from '@/hooks'
import { Button, Input } from '@/components/ui'

// ❌ Bad: Mixed import styles
import { Button } from '@/components/ui/button'
import { useSession } from '../../../hooks/useSession'
🎯 Module Exports
Index Files Pattern
typescript
// hooks/index.ts
export { useWebSocket } from './useWebSocket'
export { useCollaboration } from './useCollaboration'
export { useSession } from './useSession'
export { useFileSystem } from './useFileSystem'
export { useChat } from './useChat'
export { usePresence } from './usePresence'

// lib/index.ts
export * from './websocket'
export * from './collaboration'
export * from './file-system'
export * from './auth'
export * from './db'
export * from './storage'

// types/index.ts
export * from './session'
export * from './file'
export * from './user'
export * from './websocket'
export * from './api'
Next: Read 04-coding-standards.md for coding standards and guidelines.
```
