# GridCore - Integration Testing

## 📋 Overview

This document covers integration testing in GridCore. Integration tests verify that different parts of the application work together correctly, including API routes, WebSocket connections, and database operations.

---

## 🧪 Test Setup

### Dependencies

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0",
    "supertest": "^6.3.0",
    "ws": "^8.0.0",
    "drizzle-orm": "^0.29.0",
    "@types/supertest": "^2.0.0"
  }
}
```

### Test Database Setup

```typescript
// __tests__/setup/test-db.ts
import { drizzle } from 'drizzle-orm/vercel-postgres'
import { sql } from '@vercel/postgres'
import * as schema from '@/lib/db/schema'
import { migrate } from 'drizzle-orm/vercel-postgres/migrator'

// Test database URL
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/gridcore_test'

// Create test database client
export const testDb = drizzle(sql, { schema })

// Setup test database
export async function setupTestDb() {
  // Run migrations
  await migrate(testDb, { migrationsFolder: './lib/db/migrations' })
}

// Clean up test database
export async function cleanupTestDb() {
  const tables = ['user_sessions', 'sessions', 'users']
  for (const table of tables) {
    await testDb.execute(sql`TRUNCATE TABLE ${sql.identifier(table)} CASCADE`)
  }
}
```

// Create test user
```typescript
export async function createTestUser(overrides = {}) {
  const [user] = await testDb.insert(schema.users).values({
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed-password',
    ...overrides
  }).returning()
  return user
}
```

// Create test session
```typescript
export async function createTestSession(overrides = {}) {
  const [session] = await testDb.insert(schema.sessions).values({
    id: 'test-session-id',
    name: 'Test Session',
    ownerId: 'test-user-id',
    ...overrides
  }).returning()
  return session
}
```

## Jest Global Setup

```typescript
// __tests__/setup/global-setup.ts
import { setupTestDb, cleanupTestDb } from './test-db'

export default async function globalSetup() {
  console.log('Setting up test database...')
  await setupTestDb()
}

export async function globalTeardown() {
  console.log('Cleaning up test database...')
  await cleanupTestDb()
}
```

```typescript
// jest.config.integration.ts
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/integration/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/test-env.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  globalSetup: '<rootDir>/__tests__/setup/global-setup.ts',
  globalTeardown: '<rootDir>/__tests__/setup/global-teardown.ts',
}

export default config
```

## 🧪 API Integration Tests

### Session API Tests

```typescript
// __tests__/integration/api/sessions.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import request from 'supertest'
import { createTestUser, createTestSession, cleanupTestDb } from '../../setup/test-db'

// Get base URL from environment or default
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

describe('Sessions API', () => {
  let authToken: string
  let testUser: any

  beforeAll(async () => {
    // Create test user and get auth token
    testUser = await createTestUser()
    // In a real test, you would get an auth token via login
    authToken = 'mock-jwt-token'
  })

  afterAll(async () => {
    await cleanupTestDb()
  })

  describe('GET /api/sessions', () => {
    it('should return list of saved sessions', async () => {
      const response = await request(BASE_URL)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Cookie', `next-auth.session-token=${authToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 if not authenticated', async () => {
      const response = await request(BASE_URL)
        .get('/api/sessions')

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/sessions', () => {
    it('should create a new session', async () => {
      const response = await request(BASE_URL)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Cookie', `next-auth.session-token=${authToken}`)
        .send({ name: 'Test Session' })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('sessionId')
      expect(response.body).toHaveProperty('name', 'Test Session')
    })

    it('should create a session with default name', async () => {
      const response = await request(BASE_URL)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Cookie', `next-auth.session-token=${authToken}`)
        .send({})

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('name')
      expect(response.body.name).toMatch(/^new-session-/)
    })

    it('should return 403 when max sessions exceeded', async () => {
      // Create 3 sessions
      for (let i = 0; i < 3; i++) {
        await request(BASE_URL)
          .post('/api/sessions')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Cookie', `next-auth.session-token=${authToken}`)
          .send({ name: `Session ${i}` })
      }

      // Try to create 4th session
      const response = await request(BASE_URL)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Cookie', `next-auth.session-token=${authToken}`)
        .send({ name: 'Fourth Session' })

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error', 'Maximum 3 saved sessions allowed')
    })
  })

  describe('GET /api/sessions/:id', () => {
    it('should load a saved session', async () => {
      const session = await createTestSession()

      const response = await request(BASE_URL)
        .get(`/api/sessions/${session.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Cookie', `next-auth.session-token=${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('session')
      expect(response.body.session.id).toBe(session.id)
      expect(response.body).toHaveProperty('zip')
    })

    it('should return 404 for non-existent session', async () => {
      const response = await request(BASE_URL)
        .get('/api/sessions/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Cookie', `next-auth.session-token=${authToken}`)

      expect(response.status).toBe(404)
      expect(response.body).toHaveProperty('error', 'Session not found')
    })
  })

  describe('DELETE /api/sessions/:id', () => {
    it('should delete a saved session', async () => {
      const session = await createTestSession()

      const response = await request(BASE_URL)
        .delete(`/api/sessions/${session.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Cookie', `next-auth.session-token=${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('success', true)
    })

    it('should return 404 for non-existent session', async () => {
      const response = await request(BASE_URL)
        .delete('/api/sessions/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Cookie', `next-auth.session-token=${authToken}`)

      expect(response.status).toBe(404)
    })
})
```

## 🔌 WebSocket Integration Tests

### WebSocket Connection Tests

```typescript
// __tests__/integration/websocket/connection.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import WebSocket from 'ws'
import { createTestUser, createTestSession } from '../../setup/test-db'

const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:3000/api/websocket'

describe('WebSocket Integration', () => {
  let testUser: any
  let testSession: any
  let ws: WebSocket

  beforeAll(async () => {
    testUser = await createTestUser()
    testSession = await createTestSession()
  })

  afterAll(() => {
    if (ws) {
      ws.close()
    }
  })

  it('should connect to WebSocket', (done) => {
    ws = new WebSocket(`${WS_URL}?token=mock-token`)

    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN)
      done()
    })

    ws.on('error', (error) => {
      done(error)
    })
  })

  it('should join a session', (done) => {
    ws = new WebSocket(`${WS_URL}?token=mock-token`)

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join',
        payload: { sessionId: testSession.id }
      }))
    })

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (message.type === 'session:state') {
        expect(message.payload.sessionId).toBe(testSession.id)
        expect(message.payload.users).toContain(testUser.id)
        done()
      }
    })
  })

  it('should send and receive chat messages', (done) => {
    ws = new WebSocket(`${WS_URL}?token=mock-token`)
    let messageReceived = false

    ws.on('open', () => {
      // Join session first
      ws.send(JSON.stringify({
        type: 'join',
        payload: { sessionId: testSession.id }
      }))

      // Send chat message after join
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'chat',
          payload: {
            sessionId: testSession.id,
            content: 'Hello from test!'
          }
        }))
      }, 100)
    })

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())

      if (message.type === 'chat' && !messageReceived) {
        messageReceived = true
        expect(message.payload.content).toBe('Hello from test!')
        expect(message.payload.userId).toBe(testUser.id)
        done()
      }
    })
  })

  it('should send and receive cursor updates', (done) => {
    ws = new WebSocket(`${WS_URL}?token=mock-token`)
    let cursorReceived = false

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join',
        payload: { sessionId: testSession.id }
      }))

      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'cursor',
          payload: {
            sessionId: testSession.id,
            filePath: 'test.txt',
            position: { line: 10, column: 5 }
          }
        }))
      }, 100)
    })

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())

      if (message.type === 'cursor' && !cursorReceived) {
        cursorReceived = true
        expect(message.payload.filePath).toBe('test.txt')
        expect(message.payload.position.line).toBe(10)
        expect(message.payload.position.column).toBe(5)
        done()
      }
    })
  })
})
```

### WebSocket Broadcast Tests

```typescript
// __tests__/integration/websocket/broadcast.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import WebSocket from 'ws'
import { createTestUser, createTestSession } from '../../setup/test-db'

const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:3000/api/websocket'

describe('WebSocket Broadcast', () => {
  let testUser1: any
  let testUser2: any
  let testSession: any
  let ws1: WebSocket
  let ws2: WebSocket

  beforeAll(async () => {
    testUser1 = await createTestUser({ id: 'user-1', name: 'User 1' })
    testUser2 = await createTestUser({ id: 'user-2', name: 'User 2' })
    testSession = await createTestSession()
  })

  afterAll(() => {
    if (ws1) ws1.close()
    if (ws2) ws2.close()
  })

  it('should broadcast messages to all users in session', (done) => {
    let ws1Connected = false
    let ws2Connected = false
    let ws1Received = false
    let ws2Received = false

    // Connect first user
    ws1 = new WebSocket(`${WS_URL}?token=mock-token-1`)
    ws1.on('open', () => {
      ws1.send(JSON.stringify({
        type: 'join',
        payload: { sessionId: testSession.id }
      }))
      ws1Connected = true
      checkBothConnected()
    })

    // Connect second user
    ws2 = new WebSocket(`${WS_URL}?token=mock-token-2`)
    ws2.on('open', () => {
      ws2.send(JSON.stringify({
        type: 'join',
        payload: { sessionId: testSession.id }
      }))
      ws2Connected = true
      checkBothConnected()
    })

    function checkBothConnected() {
      if (!ws1Connected || !ws2Connected) return

      // Send diff from user 1
      ws1.send(JSON.stringify({
        type: 'diff',
        payload: {
          sessionId: testSession.id,
          filePath: 'test.txt',
          diff: { insert: 'Hello world' }
        }
      }))
    }

    ws1.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (message.type === 'diff' && !ws1Received) {
        ws1Received = true
        checkDone()
      }
    })

    ws2.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (message.type === 'diff' && !ws2Received) {
        ws2Received = true
        expect(message.payload.diff).toEqual({ insert: 'Hello world' })
        checkDone()
      }
    })

    function checkDone() {
      if (ws1Received && ws2Received) {
        done()
      }
    }
  })
})
```

## 🗄️ Database Integration Tests

### Database Query Tests

```typescript
// __tests__/integration/db/queries.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { testDb, createTestUser, createTestSession, cleanupTestDb } from '../../setup/test-db'
import { sessionQueries, userQueries } from '@/lib/db/queries'

describe('Database Queries', () => {
  let testUser: any

  beforeAll(async () => {
    testUser = await createTestUser()
  })

  afterAll(async () => {
    await cleanupTestDb()
  })

  describe('User Queries', () => {
    it('should get user by id', async () => {
      const user = await userQueries.getById(testUser.id)
      expect(user).toBeDefined()
      expect(user?.id).toBe(testUser.id)
      expect(user?.email).toBe('test@example.com')
    })

    it('should get user by email', async () => {
      const user = await userQueries.getByEmail('test@example.com')
      expect(user).toBeDefined()
      expect(user?.id).toBe(testUser.id)
    })

    it('should create a user', async () => {
      const newUser = await userQueries.create({
        name: 'New User',
        email: 'new@example.com',
        password: 'hashed-password'
      })

      expect(newUser).toBeDefined()
      expect(newUser[0].name).toBe('New User')
      expect(newUser[0].email).toBe('new@example.com')
    })
  })

  describe('Session Queries', () => {
    let testSession: any

    beforeAll(async () => {
      testSession = await createTestSession()
    })

    it('should get session by id', async () => {
      const session = await sessionQueries.getById(testSession.id)
      expect(session).toBeDefined()
      expect(session?.id).toBe(testSession.id)
      expect(session?.name).toBe('Test Session')
    })

    it('should get sessions by owner', async () => {
      const sessions = await sessionQueries.getByOwner(testUser.id)
      expect(sessions).toBeDefined()
      expect(sessions.length).toBeGreaterThan(0)
    })

    it('should count saved sessions for user', async () => {
      const count = await sessionQueries.countSavedByUser(testUser.id)
      expect(count).toBeGreaterThanOrEqual(1)
    })

    it('should save session for user', async () => {
      await sessionQueries.saveForUser(testUser.id, testSession.id)

      const hasSaved = await sessionQueries.hasSavedSession(testUser.id, testSession.id)
      expect(hasSaved).toBe(true)
    })
  })
})
```

## 🧪 Testing with Mock Services

### Mock WebSocket Server

```typescript
// __tests__/mocks/websocket-server.ts
import { WebSocketServer } from 'ws'
import { EventEmitter } from 'events'

export class MockWebSocketServer extends EventEmitter {
  private server: WebSocketServer
  private clients: Set<WebSocket> = new Set()

  constructor(port: number) {
    super()
    this.server = new WebSocketServer({ port })

    this.server.on('connection', (ws) => {
      this.clients.add(ws)

      ws.on('message', (data) => {
        this.emit('message', data, ws)
      })

      ws.on('close', () => {
        this.clients.delete(ws)
      })
    })
  }

  broadcast(data: any) {
    const message = JSON.stringify(data)
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    }
  }

  close() {
    this.server.close()
  }

  get clientCount() {
    return this.clients.size
  }
}
```

## 📊 Running Integration Tests

### Commands

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test file
npm run test:integration -- api/sessions.test.ts

# Run integration tests with coverage
npm run test:integration -- --coverage

# Run integration tests with verbose output
npm run test:integration -- --verbose
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:integration": "jest --config jest.config.integration.ts",
    "test:integration:watch": "jest --config jest.config.integration.ts --watch",
    "test:integration:coverage": "jest --config jest.config.integration.ts --coverage"
  }
}
```

Next: Read [03-e2e-tests.md](03-e2e-tests.md) for end-to-end testing documentation.
