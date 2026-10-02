# GridCore - Unit Testing

## 📋 Overview

This document covers unit testing in GridCore using **Jest** and **React Testing Library**. Unit tests verify that individual components and functions work as expected in isolation.

---

## 🧪 Testing Setup

### Dependencies

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

### Jest Configuration

```typescript
// jest.config.ts
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/stores/(.*)$': '<rootDir>/stores/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'stores/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/index.ts',
    '!**/types.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
}

export default config
```

### Jest Setup

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
      },
    },
    status: 'authenticated',
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
}))

// Mock WebSocket
class MockWebSocket {
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readyState = 0
  send = jest.fn()
  close = jest.fn()
}

Object.defineProperty(global, 'WebSocket', {
  value: MockWebSocket,
})
```

## 🧪 Testing Components

### Button Component Test

```typescript
// __tests__/components/ui/Button.test.tsx
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
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>)
    expect(screen.getByText('Click me')).toBeDisabled()
  })

  it('should show loading state', () => {
    render(<Button isLoading>Loading</Button>)
    expect(screen.getByText('⏳')).toBeInTheDocument()
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('should apply different variants', () => {
    const { rerender } = render(<Button variant="default">Default</Button>)
    expect(screen.getByText('Default')).toHaveClass('bg-accent')

    rerender(<Button variant="destructive">Destructive</Button>)
    expect(screen.getByText('Destructive')).toHaveClass('bg-destructive')

    rerender(<Button variant="outline">Outline</Button>)
    expect(screen.getByText('Outline')).toHaveClass('border-border')
  })
})
```

### Chat Panel Component Test

```typescript
// __tests__/components/chat/ChatPanel.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatPanel } from '@/components/chat/ChatPanel'

// Mock useChat hook
jest.mock('@/hooks/useChat', () => ({
  useChat: () => ({
    messages: [
      {
        id: '1',
        userId: 'user-1',
        userName: 'John',
        content: 'Hello there!',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        userId: 'user-2',
        userName: 'Jane',
        content: 'Hi John!',
        timestamp: new Date().toISOString(),
      },
    ],
    isMuted: false,
    unreadCount: 0,
    sendMessage: jest.fn(),
    toggleMute: jest.fn(),
    resetUnread: jest.fn(),
  }),
}))

// Mock useUser hook
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: {
      id: 'user-1',
      name: 'John',
      email: 'john@example.com',
    },
  }),
}))

describe('ChatPanel', () => {
  it('should render messages', () => {
    render(<ChatPanel sessionId="test-session" />)

    expect(screen.getByText('Hello there!')).toBeInTheDocument()
    expect(screen.getByText('Hi John!')).toBeInTheDocument()
  })

  it('should send a message', async () => {
    const sendMessage = jest.fn()
    jest.spyOn(require('@/hooks/useChat'), 'useChat').mockImplementation(() => ({
      messages: [],
      isMuted: false,
      unreadCount: 0,
      sendMessage,
      toggleMute: jest.fn(),
      resetUnread: jest.fn(),
    }))

    render(<ChatPanel sessionId="test-session" />)

    const input = screen.getByPlaceholderText('Type a message (200 char max)...')
    const button = screen.getByRole('button', { name: /send/i })

    await userEvent.type(input, 'Hello world!')
    fireEvent.click(button)

    expect(sendMessage).toHaveBeenCalledWith('Hello world!')
  })

  it('should show character limit', () => {
    render(<ChatPanel sessionId="test-session" />)

    const input = screen.getByPlaceholderText('Type a message (200 char max)...')
    fireEvent.change(input, { target: { value: 'Hello' } })

    expect(screen.getByText('5/200 characters')).toBeInTheDocument()
  })

  it('should toggle mute', () => {
    const toggleMute = jest.fn()
    jest.spyOn(require('@/hooks/useChat'), 'useChat').mockImplementation(() => ({
      messages: [],
      isMuted: false,
      unreadCount: 0,
      sendMessage: jest.fn(),
      toggleMute,
      resetUnread: jest.fn(),
    }))

    render(<ChatPanel sessionId="test-session" />)

    const muteButton = screen.getByRole('button', { name: /mute/i })
    fireEvent.click(muteButton)

    expect(toggleMute).toHaveBeenCalled()
  })
})
```

## 🧪 Testing Hooks

### useChat Hook Test

```typescript
// __tests__/hooks/useChat.test.ts
import { renderHook, act } from '@testing-library/react'
import { useChat } from '@/hooks/useChat'
import { useChatStore } from '@/stores/chatStore'

// Mock WebSocket
jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    send: jest.fn(),
    isConnected: true,
    onEvent: jest.fn(),
  }),
}))

// Mock useUser
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    userId: 'test-user',
    userName: 'Test User',
  }),
}))

describe('useChat', () => {
  beforeEach(() => {
    // Reset chat store
    useChatStore.setState({
      messages: [],
      isMuted: false,
      unreadCount: 0,
    })
  })

  it('should initialize with empty messages', () => {
    const { result } = renderHook(() => useChat({ sessionId: 'test-session' }))

    expect(result.current.messages).toEqual([])
    expect(result.current.isMuted).toBe(false)
    expect(result.current.unreadCount).toBe(0)
  })

  it('should send a message', () => {
    const send = jest.fn()
    jest.spyOn(require('@/hooks/useWebSocket'), 'useWebSocket').mockImplementation(() => ({
      send,
      isConnected: true,
      onEvent: jest.fn(),
    }))

    const { result } = renderHook(() => useChat({ sessionId: 'test-session' }))

    act(() => {
      result.current.sendMessage('Hello world!')
    })

    expect(send).toHaveBeenCalledWith('chat', {
      sessionId: 'test-session',
      content: 'Hello world!',
    })
  })

  it('should not send empty messages', () => {
    const send = jest.fn()
    jest.spyOn(require('@/hooks/useWebSocket'), 'useWebSocket').mockImplementation(() => ({
      send,
      isConnected: true,
      onEvent: jest.fn(),
    }))

    const { result } = renderHook(() => useChat({ sessionId: 'test-session' }))

    act(() => {
      result.current.sendMessage('   ')
    })

    expect(send).not.toHaveBeenCalled()
  })

  it('should not send messages over 200 characters', () => {
    const send = jest.fn()
    jest.spyOn(require('@/hooks/useWebSocket'), 'useWebSocket').mockImplementation(() => ({
      send,
      isConnected: true,
      onEvent: jest.fn(),
    }))

    const { result } = renderHook(() => useChat({ sessionId: 'test-session' }))
    const longMessage = 'a'.repeat(201)

    act(() => {
      result.current.sendMessage(longMessage)
    })

    expect(send).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Message exceeds 200 character limit')
  })

  it('should toggle mute', () => {
    const { result } = renderHook(() => useChat({ sessionId: 'test-session' }))

    expect(result.current.isMuted).toBe(false)

    act(() => {
      result.current.toggleMute()
    })

    expect(result.current.isMuted).toBe(true)
  })
})
```

## 🧪 Testing Stores

### Chat Store Test

```typescript
// __tests__/stores/chatStore.test.ts
import { useChatStore } from '@/stores/chatStore'

describe('ChatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      isMuted: false,
      unreadCount: 0,
    })
  })

  it('should add a message', () => {
    const message = {
      id: '1',
      userId: 'user-1',
      userName: 'John',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    }

    useChatStore.getState().addMessage(message)

    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0]).toEqual(message)
    expect(state.unreadCount).toBe(1)
  })

  it('should clear messages', () => {
    const message = {
      id: '1',
      userId: 'user-1',
      userName: 'John',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    }

    useChatStore.getState().addMessage(message)
    useChatStore.getState().clearMessages()

    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(0)
    expect(state.unreadCount).toBe(0)
  })

  it('should toggle mute', () => {
    expect(useChatStore.getState().isMuted).toBe(false)

    useChatStore.getState().toggleMute()
    expect(useChatStore.getState().isMuted).toBe(true)

    useChatStore.getState().toggleMute()
    expect(useChatStore.getState().isMuted).toBe(false)
  })

  it('should reset unread count', () => {
    const message = {
      id: '1',
      userId: 'user-1',
      userName: 'John',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    }

    useChatStore.getState().addMessage(message)
    expect(useChatStore.getState().unreadCount).toBe(1)

    useChatStore.getState().resetUnread()
    expect(useChatStore.getState().unreadCount).toBe(0)
  })
})
```

### File Store Test

```typescript
// __tests__/stores/fileStore.test.ts
import { useFileStore } from '@/stores/fileStore'

describe('FileStore', () => {
  beforeEach(() => {
    useFileStore.setState({
      files: [],
      openFiles: [],
      activeFile: null,
      fileContents: new Map(),
      isDirty: false,
    })
  })

  it('should load files', () => {
    const files = [
      {
        name: 'test.txt',
        path: 'test.txt',
        type: 'file' as const,
        content: 'Hello World',
        extension: 'txt',
      },
    ]

    useFileStore.getState().loadFiles(files)

    const state = useFileStore.getState()
    expect(state.files).toEqual(files)
    expect(state.isDirty).toBe(false)
  })

  it('should open a file', () => {
    const files = [
      {
        name: 'test.txt',
        path: 'test.txt',
        type: 'file' as const,
        content: 'Hello World',
        extension: 'txt',
      },
    ]

    useFileStore.getState().loadFiles(files)
    useFileStore.getState().openFile('test.txt')

    const state = useFileStore.getState()
    expect(state.openFiles).toContain('test.txt')
  })

  it('should update file content', () => {
    const files = [
      {
        name: 'test.txt',
        path: 'test.txt',
        type: 'file' as const,
        content: 'Hello World',
        extension: 'txt',
      },
    ]

    useFileStore.getState().loadFiles(files)
    useFileStore.getState().updateFileContent('test.txt', 'Updated content')

    const state = useFileStore.getState()
    expect(state.fileContents.get('test.txt')).toBe('Updated content')
    expect(state.isDirty).toBe(true)
  })

  it('should delete a file', () => {
    const files = [
      {
        name: 'test.txt',
        path: 'test.txt',
        type: 'file' as const,
        content: 'Hello World',
        extension: 'txt',
      },
    ]

    useFileStore.getState().loadFiles(files)
    useFileStore.getState().openFile('test.txt')
    useFileStore.getState().deleteFile('test.txt')

    const state = useFileStore.getState()
    expect(state.files).toHaveLength(0)
    expect(state.openFiles).not.toContain('test.txt')
    expect(state.activeFile).toBeNull()
  })
})
```

## 🧪 Testing Utilities

### Color Utility Test

```typescript
// __tests__/lib/colors.test.ts
import { getUserColor, getContrastColor, lightenColor, darkenColor } from '@/lib/colors'

describe('Color Utilities', () => {
  it('should generate consistent colors for users', () => {
    const userId1 = 'user-123'
    const userId2 = 'user-456'

    const color1 = getUserColor(userId1)
    const color2 = getUserColor(userId2)

    expect(color1).toBeDefined()
    expect(color2).toBeDefined()
    expect(color1).not.toBe(color2)
  })

  it('should generate same color for same user', () => {
    const userId = 'user-123'
    const color1 = getUserColor(userId)
    const color2 = getUserColor(userId)

    expect(color1).toBe(color2)
  })

  it('should get contrast color', () => {
    expect(getContrastColor('#000000')).toBe('#FFFFFF')
    expect(getContrastColor('#FFFFFF')).toBe('#000000')
  })

  it('should lighten color', () => {
    const color = '#000000'
    const lightened = lightenColor(color, 50)
    expect(lightened).toBe('#323232')
  })

  it('should darken color', () => {
    const color = '#FFFFFF'
    const darkened = darkenColor(color, 50)
    expect(darkened).toBe('#CDCDCD')
  })
})
```

### Validation Utility Test

```typescript
// __tests__/lib/validators.test.ts
import { validatePassword, validateEmail } from '@/lib/validators'

describe('Validators', () => {
  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const result = validatePassword('StrongPass123!')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject short password', () => {
      const result = validatePassword('Short1!')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must be at least 8 characters')
    })

    it('should reject password without uppercase', () => {
      const result = validatePassword('lowercase123!')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
    })

    it('should reject password without number', () => {
      const result = validatePassword('NoNumber!')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one number')
    })
  })

  describe('validateEmail', () => {
    it('should validate valid email', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('test.user@domain.co.uk')).toBe(true)
    })

    it('should reject invalid email', () => {
      expect(validateEmail('invalid')).toBe(false)
      expect(validateEmail('test@')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
      expect(validateEmail('test@domain')).toBe(false)
    })
  })
})
```

## 📊 Running Tests

### Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- Button.test.tsx

# Run tests for a specific path
npm test -- components/chat
```

### Test Output

```
 PASS  __tests__/components/Button.test.tsx
   Button
     ✓ should render children (5 ms)
     ✓ should handle click events (3 ms)
     ✓ should be disabled when disabled prop is true (2 ms)
     ✓ should show loading state (2 ms)
     ✓ should apply different variants (4 ms)

  PASS  __tests__/components/chat/ChatPanel.test.tsx
   ChatPanel
     ✓ should render messages (15 ms)
     ✓ should send a message (23 ms)
     ✓ should show character limit (8 ms)
     ✓ should toggle mute (7 ms)

  PASS  __tests__/stores/chatStore.test.ts
   ChatStore
     ✓ should add a message (2 ms)
     ✓ should clear messages (2 ms)
     ✓ should toggle mute (1 ms)
     ✓ should reset unread count (1 ms)
```

Test Suites: 3 passed, 3 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        2.345 s
Next: Read 02-integration-tests.md for integration testing documentation.

```
