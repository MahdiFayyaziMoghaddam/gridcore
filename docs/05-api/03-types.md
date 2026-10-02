# GridCore - TypeScript Type Definitions

## 📋 Overview

This document defines all TypeScript types used throughout the GridCore project. These types ensure type safety across the application and provide clear interfaces for all data structures.

---

## 📦 Core Types

### Session Types

```typescript
// types/session.ts

export interface Session {
  id: string
  name: string
  ownerId: string
  tempOwnerId?: string
  users: string[]
  isSaved: boolean
  zipUrl?: string
  createdAt: Date
  updatedAt?: Date
}

export interface SessionState {
  sessionId: string | null
  sessionName: string
  ownerId: string | null
  tempOwnerId: string | null
  isSaved: boolean
  isOwner: boolean
  isTempOwner: boolean
  userCount: number
}

export interface SavedSession {
  id: string
  name: string
  ownerId: string
  zipUrl: string
  createdAt: Date
  updatedAt: Date
}

export interface SessionMetadata {
  sessionId: string
  lastActivity: Date
  messageCount: number
  fileCount: number
}
File Types
typescript
// types/file.ts

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  content?: string
  children?: FileNode[]
  extension?: string
  size?: number
  lastModified?: Date
}

export interface FileTree {
  root: string
  children: FileNode[]
}

export interface FileContent {
  path: string
  content: string
  encoding: 'utf-8'
}

export interface FileOperation {
  type: 'create' | 'delete' | 'rename' | 'move'
  path: string
  newPath?: string
  content?: string
}

export interface FileValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export type FileIcon = 'file' | 'folder' | 'typescript' | 'javascript' | 'python' | 'html' | 'css' | 'json' | 'markdown' | 'text'
User Types
typescript
// types/user.ts

export interface User {
  id: string
  name: string
  email: string
  color: string
  avatar?: string
  isOnline: boolean
  status: UserStatus
  currentFile?: string
  cursor?: CursorPosition
  lastActive: Date
}

export interface UserState {
  id: string
  name: string
  email: string
  color: string
  isOnline: boolean
  status: UserStatus
}

export type UserStatus = 'online' | 'idle' | 'editing' | 'away'

export interface CursorPosition {
  filePath: string
  line: number
  column: number
  selection?: {
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
  }
}

export interface UserPresence {
  userId: string
  userName: string
  color: string
  cursor?: CursorPosition
  status: UserStatus
  currentFile?: string
}

export interface UserRole {
  userId: string
  role: 'owner' | 'temp_owner' | 'user'
}
WebSocket Types
typescript
// types/websocket.ts

export interface WSMessage {
  type: WebSocketEventType
  payload: any
  timestamp?: number
}

export type WebSocketEventType =
  | 'join'
  | 'leave'
  | 'session:state'
  | 'session:closed'
  | 'session:id-changed'
  | 'session:saved'
  | 'diff'
  | 'cursor'
  | 'status'
  | 'file:created'
  | 'file:deleted'
  | 'file:renamed'
  | 'chat'
  | 'ownership:granted'
  | 'ownership:revoked'
  | 'ownership:transferred'
  | 'ownership:promoted'
  | 'ownership:demoted'
  | 'ownership:reclaimed'
  | 'user:joined'
  | 'user:left'
  | 'user:status'
  | 'user:cursor'
  | 'user:file'
  | 'request:zip'
  | 'send:zip'
  | 'receive:zip'
  | 'request:save'
  | 'error'

export interface WSJoinPayload {
  sessionId: string
}

export interface WSLeavePayload {
  sessionId: string
}

export interface WSSessionStatePayload {
  sessionId: string
  sessionName: string
  ownerId: string
  tempOwnerId?: string
  users: string[]
  isSaved: boolean
}

export interface WSDiffPayload {
  sessionId: string
  filePath: string
  diff: any
}

export interface WSCursorPayload {
  sessionId: string
  filePath: string
  position: {
    line: number
    column: number
  }
}

export interface WSChatPayload {
  sessionId: string
  content: string
}

export interface WSFileCreatePayload {
  sessionId: string
  path: string
  content?: string
}

export interface WSFileDeletePayload {
  sessionId: string
  path: string
}

export interface WSFileRenamePayload {
  sessionId: string
  oldPath: string
  newPath: string
}

export interface WSOwnershipGrantPayload {
  sessionId: string
  userId: string
}

export interface WSErrorPayload {
  error: string
  code?: string
}

export interface WebSocketState {
  isConnected: boolean
  sessionId: string | null
  userId: string | null
  connectionId: string | null
  lastMessage: Date | null
  reconnectAttempts: number
}
API Types
typescript
// types/api.ts

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  code?: string
  details?: any
}

export interface ApiError {
  error: string
  code?: string
  details?: any
}

export interface CreateSessionRequest {
  name?: string
}

export interface CreateSessionResponse {
  sessionId: string
  name: string
  ownerId: string
  createdAt: string
}

export interface SaveSessionRequest {
  zip: string // base64
  name?: string
}

export interface SaveSessionResponse {
  success: boolean
  zipUrl: string
}

export interface CheckSessionResponse {
  exists: boolean
  isActive?: boolean
  userCount?: number
  maxUsers?: number
  isSaved?: boolean
  reason?: string
}

export interface LoadSessionResponse {
  session: SavedSession
  zip: string // base64
}

export interface UserProfileResponse {
  id: string
  name: string
  email: string
  createdAt: string
}

export interface UpdateUserRequest {
  name?: string
  email?: string
}
🗄️ Database Types
Schema Types
typescript
// types/database.ts

export interface DBUser {
  id: string
  name: string
  email: string
  password: string | null
  githubId: string | null
  googleId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DBSession {
  id: string
  name: string
  ownerId: string
  zipUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DBUserSession {
  userId: string
  sessionId: string
  savedAt: Date
}

export interface DBUserWithSessions extends DBUser {
  savedSessions: DBUserSession[]
  ownedSessions: DBSession[]
}

export interface DBSessionWithOwner extends DBSession {
  owner: DBUser
  users: DBUserSession[]
}
🎨 UI Types
Component Props
typescript
// types/ui.ts

export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
  testId?: string
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

export interface InputProps extends BaseComponentProps {
  type?: 'text' | 'email' | 'password' | 'number'
  value?: string
  defaultValue?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  onChange?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
}

export interface DialogProps extends BaseComponentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
}

export interface ToastProps {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  description?: string
  duration?: number
}
Store Types
typescript
// types/store.ts

export interface SessionStore {
  sessionId: string | null
  sessionName: string
  ownerId: string | null
  tempOwnerId: string | null
  isSaved: boolean
  isOwner: boolean
  isTempOwner: boolean
  users: User[]
  setSession: (session: Session) => void
  setUsers: (users: User[]) => void
  addUser: (user: User) => void
  removeUser: (userId: string) => void
  updateUserStatus: (userId: string, status: UserStatus) => void
  clearSession: () => void
}

export interface FileStore {
  files: FileNode[]
  openFiles: string[]
  activeFile: string | null
  fileContents: Map<string, string>
  isDirty: boolean
  loadFiles: (files: FileNode[]) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  createFile: (path: string, content?: string) => void
  deleteFile: (path: string) => void
  renameFile: (oldPath: string, newPath: string) => void
  getFileContent: (path: string) => string | null
  reset: () => void
}

export interface ChatStore {
  messages: ChatMessage[]
  isMuted: boolean
  unreadCount: number
  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  toggleMute: () => void
  setMuted: (muted: boolean) => void
  incrementUnread: () => void
  resetUnread: () => void
}

export interface UserStore {
  currentUser: User | null
  users: Map<string, User>
  onlineCount: number
  setCurrentUser: (user: User) => void
  addUser: (user: User) => void
  removeUser: (userId: string) => void
  updateUserStatus: (userId: string, status: UserStatus) => void
  updateUserCursor: (userId: string, cursor: CursorPosition) => void
  updateUserFile: (userId: string, filePath: string) => void
  clearUsers: () => void
  getUser: (userId: string) => User | undefined
}

export interface UIStore {
  sidebarWidth: number
  isSidebarOpen: boolean
  activeSidebarTab: 'files' | 'chat' | 'users'
  isSaving: boolean
  isImporting: boolean
  isExporting: boolean
  notifications: Notification[]
  setSidebarWidth: (width: number) => void
  toggleSidebar: () => void
  setActiveSidebarTab: (tab: 'files' | 'chat' | 'users') => void
  setSaving: (saving: boolean) => void
  setImporting: (importing: boolean) => void
  setExporting: (exporting: boolean) => void
  addNotification: (notification: Notification) => void
  removeNotification: (id: string) => void
}
🔧 Utility Types
Type Helpers
typescript
// types/utils.ts

export type Nullable<T> = T | null

export type Optional<T> = T | undefined

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type ReadonlyDeep<T> = {
  readonly [P in keyof T]: T[P] extends object ? ReadonlyDeep<T[P]> : T[P]
}

export type PickByType<T, U> = {
  [P in keyof T as T[P] extends U ? P : never]: T[P]
}

export type OmitByType<T, U> = {
  [P in keyof T as T[P] extends U ? never : P]: T[P]
}

export type NonEmptyArray<T> = [T, ...T[]]

export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P]
}

export type ValueOf<T> = T[keyof T]

export type KeyOf<T> = keyof T

export type AtLeastOne<T> = {
  [K in keyof T]: Pick<T, K>
}[keyof T]

export type ExactlyOne<T> = {
  [K in keyof T]: Pick<T, K> & Partial<Omit<T, K>>
}[keyof T]
Guard Functions
typescript
// types/guards.ts

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value)
}

export function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function isUser(value: unknown): value is User {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.email)
  )
}

export function isSession(value: unknown): value is Session {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.ownerId)
  )
}
📤 Export
types/index.ts
typescript
// Core types
export * from './session'
export * from './file'
export * from './user'
export * from './websocket'
export * from './api'

// Database types
export * from './database'

// UI types
export * from './ui'
export * from './store'

// Utility types
export * from './utils'
export * from './guards'
Next: Proceed to 06-deployment/01-vercel-config.md for Vercel deployment configuration.
```
