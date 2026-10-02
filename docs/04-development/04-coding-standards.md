# GridCore - Coding Standards

## 📋 Overview

This document defines the coding standards, style guidelines, and best practices for the GridCore project. Following these standards ensures consistency, readability, and maintainability across the codebase.

---

## 🎯 General Principles

### 1. Readability First

- Write code that is easy to read and understand
- Use descriptive variable and function names
- Keep functions small and focused
- Comment complex logic, not obvious code

### 2. Consistency

- Follow the established patterns in the codebase
- Use the same naming conventions throughout
- Stick to one style per file

### 3. Type Safety

- Use TypeScript with strict mode enabled
- Avoid `any` type
- Define proper interfaces and types
- Use discriminated unions for state management

### 4. Performance

- Avoid unnecessary re-renders
- Use memoization appropriately
- Debounce frequent events
- Lazy load heavy components

---

## 🔤 Naming Conventions

### Variables & Functions

```typescript
// ✅ Good: camelCase
const userName = 'John'
const userCount = 10
function getUserById(id: string) { }

// ❌ Bad: snake_case or PascalCase
const user_name = 'John'
const UserCount = 10
function GetUserById(id: string) { }
Components
typescript
// ✅ Good: PascalCase
const UserProfile = () => { }
const FileTree = () => { }

// ❌ Bad: camelCase
const userProfile = () => { }
Interfaces & Types
typescript
// ✅ Good: PascalCase with I prefix for interfaces (optional)
interface IUser { }
type UserStatus = 'online' | 'offline'

// ✅ Good: PascalCase without prefix
interface User { }
type Status = 'online' | 'offline'

// ❌ Bad: camelCase
interface user { }
type userStatus = 'online' | 'offline'
Constants
typescript
// ✅ Good: UPPER_SNAKE_CASE
const MAX_USERS = 20
const API_BASE_URL = 'https://api.example.com'

// ❌ Bad: camelCase
const maxUsers = 20
const apiBaseUrl = 'https://api.example.com'
Enums
typescript
// ✅ Good: PascalCase for enum, UPPER_SNAKE_CASE for values
enum SessionStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  SAVED = 'saved'
}

// ❌ Bad: camelCase
enum sessionStatus {
  active = 'active'
}
Files
typescript
// ✅ Good: kebab-case for files
// user-profile.tsx
// use-session.ts
// session-store.ts

// ✅ Good: PascalCase for components
// UserProfile.tsx
// FileTree.tsx
📝 TypeScript Standards
Type Definitions
typescript
// ✅ Good: Use interfaces for objects
interface User {
  id: string
  name: string
  email: string
}

// ✅ Good: Use type for unions and primitives
type UserRole = 'owner' | 'temp_owner' | 'user'
type UserId = string

// ❌ Bad: Using any
function getData(data: any) { } // ❌

// ✅ Good: Use unknown for uncertain types
function getData(data: unknown) {
  if (typeof data === 'string') {
    // Type-safe
  }
}
Generics
typescript
// ✅ Good: Use generics for reusable functions
function getById<T>(id: string, items: T[]): T | undefined {
  return items.find(item => (item as any).id === id)
}

// ✅ Good: Descriptive generic names
function mapArray<TInput, TOutput>(
  items: TInput[],
  mapper: (item: TInput) => TOutput
): TOutput[] {
  return items.map(mapper)
}

// ❌ Bad: Single letter generics without context
function map<T, U>(items: T[], fn: (item: T) => U): U[] { }
Type Guards
typescript
// ✅ Good: Use type guards for safety
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'email' in value
  )
}

// Usage
if (isUser(data)) {
  console.log(data.name) // Type-safe
}
📂 Imports & Exports
Import Order
typescript
// 1. External libraries
import { useState, useEffect } from 'react'
import { create } from 'zustand'

// 2. Internal absolute imports
import { useSession } from '@/hooks/useSession'
import { Button } from '@/components/ui/button'

// 3. Relative imports
import { helper } from './helpers'

// 4. Types
import type { User, Session } from '@/types'
Export Patterns
typescript
// ✅ Good: Named exports for multiple items
export const useSession = () => { }
export const useUser = () => { }

// ✅ Good: Default export for main component
export default function SessionPage() { }

// ✅ Good: Export all from index
export * from './useSession'
export * from './useUser'
🎨 React Standards
Component Structure
typescript
// ✅ Good: Clear component structure
import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'
import { Button } from '@/components/ui/button'

interface ComponentProps {
  sessionId: string
  onClose: () => void
}

export function SessionPanel({ sessionId, onClose }: ComponentProps) {
  // 1. Hooks
  const { session, isLoading } = useSession(sessionId)
  const [isEditing, setIsEditing] = useState(false)

  // 2. Effects
  useEffect(() => {
    // Effect logic
  }, [sessionId])

  // 3. Handlers
  const handleSave = () => {
    // Save logic
  }

  // 4. Render
  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="session-panel">
      <h1>{session?.name}</h1>
      <Button onClick={handleSave}>Save</Button>
    </div>
  )
}
Hooks
typescript
// ✅ Good: Custom hooks with clear return types
interface UseSessionReturn {
  session: Session | null
  isLoading: boolean
  error: Error | null
  saveSession: () => Promise<void>
}

export function useSession(sessionId: string): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    loadSession()
  }, [sessionId])

  const loadSession = async () => {
    try {
      const data = await fetchSession(sessionId)
      setSession(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSession = async () => {
    // Save logic
  }

  return {
    session,
    isLoading,
    error,
    saveSession
  }
}
Props & State
typescript
// ✅ Good: Destructure props
function Component({ title, onAction, children }: ComponentProps) {
  // ...
}

// ❌ Bad: Using props object directly
function Component(props: ComponentProps) {
  // props.title, props.onAction
}

// ✅ Good: Use state updater function
setState(prev => ({ ...prev, count: prev.count + 1 }))

// ❌ Bad: Direct state mutation
setState({ ...state, count: state.count + 1 })
🎯 Zustand Store Standards
Store Definition
typescript
// ✅ Good: Clear store structure
interface SessionStore {
  // State
  sessionId: string | null
  sessionName: string
  users: User[]

  // Actions
  setSession: (session: Session) => void
  addUser: (user: User) => void
  removeUser: (userId: string) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionStore>()(
  devtools(
    (set) => ({
      // Initial state
      sessionId: null,
      sessionName: '',
      users: [],

      // Actions
      setSession: (session) => {
        set({
          sessionId: session.id,
          sessionName: session.name,
          users: session.users
        })
      },

      addUser: (user) => {
        set((state) => ({
          users: [...state.users, user]
        }))
      },

      removeUser: (userId) => {
        set((state) => ({
          users: state.users.filter(u => u.id !== userId)
        }))
      },

      clearSession: () => {
        set({
          sessionId: null,
          sessionName: '',
          users: []
        })
      }
    }),
    { name: 'session-store' }
  )
)
🧪 Testing Standards
Unit Tests
typescript
// ✅ Good: Clear test structure
describe('SessionStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useSessionStore.setState({ sessionId: null, users: [] })
  })

  it('should add a user', () => {
    const { addUser } = useSessionStore.getState()
    const user = { id: '1', name: 'John' }

    addUser(user)

    const users = useSessionStore.getState().users
    expect(users).toContainEqual(user)
  })

  it('should remove a user', () => {
    const { addUser, removeUser } = useSessionStore.getState()
    const user = { id: '1', name: 'John' }

    addUser(user)
    removeUser(user.id)

    const users = useSessionStore.getState().users
    expect(users).not.toContainEqual(user)
  })
})
Component Tests
typescript
// ✅ Good: Test component behavior
import { render, screen, fireEvent } from '@testing-library/react'
import { UserList } from './UserList'

describe('UserList', () => {
  it('should render list of users', () => {
    const users = [
      { id: '1', name: 'John' },
      { id: '2', name: 'Jane' }
    ]

    render(<UserList users={users} />)

    expect(screen.getByText('John')).toBeInTheDocument()
    expect(screen.getByText('Jane')).toBeInTheDocument()
  })

  it('should call onUserClick when user is clicked', () => {
    const onUserClick = jest.fn()
    const users = [{ id: '1', name: 'John' }]

    render(<UserList users={users} onUserClick={onUserClick} />)

    fireEvent.click(screen.getByText('John'))
    expect(onUserClick).toHaveBeenCalledWith('1')
  })
})
📝 Documentation Standards
JSDoc Comments
typescript
/**
 * Creates a new session for the authenticated user.
 *
 * @param name - The optional name for the session
 * @returns The session ID of the newly created session
 * @throws {Error} If the user is not authenticated
 * @throws {Error} If the user has reached the maximum number of sessions
 *
 * @example
 * ```typescript
 * const sessionId = await createSession('My Project')
 * console.log(`Session created: ${sessionId}`)
 * ```
 */
export async function createSession(name?: string): Promise<string> {
  // Implementation
}
Component Documentation
typescript
/**
 * FileTree component displays the file explorer in the sidebar.
 *
 * Features:
 * - Expandable folders
 * - File icons based on extension
 * - Context menu for file operations
 * - Drag and drop support (future)
 *
 * @component
 */
export function FileTree({ files, onFileClick, onFileCreate, onFileDelete, onFileRename, canEdit }: FileTreeProps) {
  // Implementation
}
🚫 Anti-Patterns to Avoid
1. Mutating State
typescript
// ❌ Bad: Direct mutation
const state = useSessionStore.getState()
state.users.push(newUser)

// ✅ Good: Use store actions
useSessionStore.getState().addUser(newUser)
2. Inline Styles
typescript
// ❌ Bad: Inline styles
<div style={{ padding: '10px', margin: '5px' }}>

// ✅ Good: Tailwind classes
<div className="p-2 m-1">
3. Magic Numbers
typescript
// ❌ Bad: Magic numbers
if (response.status === 429) { }

// ✅ Good: Constants
const RATE_LIMIT_STATUS = 429
if (response.status === RATE_LIMIT_STATUS) { }
4. Nested Callbacks
typescript
// ❌ Bad: Callback hell
function handleSave() {
  validate().then(() => {
    save().then(() => {
      notify().then(() => {
        // ...
      })
    })
  })
}

// ✅ Good: Async/await
async function handleSave() {
  await validate()
  await save()
  await notify()
}
5. Prop Drilling
typescript
// ❌ Bad: Prop drilling
<Grandparent data={data}>
  <Parent data={data}>
    <Child data={data}>
      <Grandchild data={data} />
    </Child>
  </Parent>
</Grandparent>

// ✅ Good: Context or Zustand
<Provider>
  <Grandparent>
    <Parent>
      <Child>
        <Grandchild />
      </Child>
    </Parent>
  </Grandparent>
</Provider>
📋 Code Review Checklist
General
□ Code follows naming conventions
□ No any type used
□ Proper error handling
□ No console.logs left
□ No commented out code
React
□ Components are properly typed
□ Hooks follow rules of hooks
□ No unnecessary re-renders
□ Proper key usage in lists
□ Event handlers are memoized
State
□ State updates are immutable
□ Zustand stores are properly typed
□ Actions have clear names
□ No duplicate state
Performance
□ Large lists are virtualized
□ Debouncing for frequent events
□ Lazy loading for heavy components
□ Memoization where appropriate
Security
□ No sensitive data in logs
□ Input validation
□ Proper error messages (no info leakage)
□ CSRF protection
Accessibility
□ Proper ARIA labels
□ Keyboard navigation
□ Focus management
□ Color contrast
🔧 Development Tools
ESLint Configuration
json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
Prettier Configuration
json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "avoid"
}
📝 Git Commit Standards
Commit Message Format
text
<type>(<scope>): <subject>

<body>

<footer>
Types
feat: New feature

fix: Bug fix

docs: Documentation

style: Formatting

refactor: Code refactoring

test: Tests

chore: Maintenance

Examples

```bash
feat(session): add save session functionality

- Add save button to navbar
- Implement client-side ZIP creation
- Upload ZIP to Vercel Blob Storage
- Save session metadata to database

Closes #123
```

```bash
fix(websocket): handle reconnection on disconnect

- Add automatic reconnection logic
- Implement exponential backoff
- Preserve session state during reconnection

Fixes #456
```

Next: Read [05-database-migrations.md](05-database-migrations.md) for database migration details.
