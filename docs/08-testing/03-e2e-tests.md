# GridCore - End-to-End Testing

## 📋 Overview

This document covers end-to-end (E2E) testing in GridCore using **Playwright**. E2E tests simulate real user interactions to verify that the entire application works correctly from the user's perspective.

---

## 🧪 Test Setup

### Dependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@types/node": "^20.0.0"
  }
}
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
```

## Test Helpers

```typescript
// __tests__/e2e/helpers/auth.ts
import { Page } from '@playwright/test'

export async function login(page: Page, email: string = 'test@example.com', password: string = 'password123') {
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/sessions')
}

export async function register(page: Page, name: string = 'Test User', email: string = 'test@example.com', password: string = 'password123') {
  await page.goto('/register')
  await page.fill('input[name="name"]', name)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.fill('input[name="confirmPassword"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/sessions')
}

export async function logout(page: Page) {
  await page.click('[aria-label="User menu"]')
  await page.click('text=Logout')
  await page.waitForURL('/')
}

export async function createSession(page: Page, name?: string) {
  await page.click('text=New Session')
  if (name) {
    await page.fill('input[name="sessionName"]', name)
  }
  await page.click('button:has-text("Create")')
  await page.waitForURL(/\/session\/.+/)
}

export async function joinSession(page: Page, sessionId: string) {
  await page.goto(`/session/join`)
  await page.fill('input[name="sessionId"]', sessionId)
  await page.click('button:has-text("Join")`)
  await page.waitForURL(`/session/${sessionId}`)
}
```

## 📝 E2E Test Scenarios

### Authentication Tests

```typescript
// __tests__/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'
import { login, register, logout } from './helpers/auth'

test.describe('Authentication', () => {
  test('should register a new user', async ({ page }) => {
    await page.goto('/register')

    await page.fill('input[name="name"]', 'New User')
    await page.fill('input[type="email"]', 'newuser@example.com')
    await page.fill('input[type="password"]', 'TestPass123!')
    await page.fill('input[name="confirmPassword"]', 'TestPass123!')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/sessions')
    await expect(page.locator('[aria-label="User menu"]')).toBeVisible()
  })

  test('should login with credentials', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL('/sessions')
    await expect(page.locator('[aria-label="User menu"]')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expect(page.locator('[role="alert"]')).toBeVisible()
    await expect(page.locator('text=Invalid credentials')).toBeVisible()
  })

  test('should logout', async ({ page }) => {
    await login(page)
    await logout(page)
    await expect(page).toHaveURL('/')
    await expect(page.locator('text=Sign In')).toBeVisible()
  })

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/sessions')
    await expect(page).toHaveURL('/login')
  })
})
```

### Session Tests

```typescript
// __tests__/e2e/session.spec.ts
import { test, expect } from '@playwright/test'
import { login, createSession, joinSession } from './helpers/auth'

test.describe('Session Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should create a new session', async ({ page }) => {
    await page.click('text=New Session')
    await page.fill('input[name="sessionName"]', 'My Test Session')
    await page.click('button:has-text("Create")')

    await expect(page).toHaveURL(/\/session\/.+/)
    await expect(page.locator('text=My Test Session')).toBeVisible()
  })

  test('should create a session with default name', async ({ page }) => {
    await page.click('text=New Session')
    await page.click('button:has-text("Create")')

    await expect(page).toHaveURL(/\/session\/.+/)
    await expect(page.locator('text=new-session-')).toBeVisible()
  })

  test('should show saved sessions list', async ({ page }) => {
    // Create a session first
    await createSession(page, 'Saved Session')

    // Go back to sessions list
    await page.goto('/sessions')

    await expect(page.locator('text=Sessions')).toBeVisible()
    await expect(page.locator('text=Saved Session')).toBeVisible()
  })

  test('should join a session by ID', async ({ page }) => {
    // Create a session and get its ID
    await createSession(page, 'Join Test')
    const url = page.url()
    const sessionId = url.split('/').pop()!

    // Open a new page and join
    const newPage = await page.context().newPage()
    await login(newPage)
    await newPage.goto('/session/join')
    await newPage.fill('input[name="sessionId"]', sessionId)
    await newPage.click('button:has-text("Join")')

    await expect(newPage).toHaveURL(`/session/${sessionId}`)
  })

  test('should save a session', async ({ page }) => {
    await createSession(page, 'Save Test')

    // Wait for editor to load
    await page.waitForSelector('.editor-container')

    // Click save button
    await page.click('button:has-text("Save")')

    // Should show saved status
    await expect(page.locator('text=Saved')).toBeVisible()
  })

  test('should export a session', async ({ page }) => {
    await createSession(page, 'Export Test')

    // Wait for editor to load
    await page.waitForSelector('.editor-container')

    // Click export button
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export")')
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  })
})
```

### Editor Tests
// __tests__/e2e/editor.spec.ts
import { test, expect } from '@playwright/test'
import { login, createSession } from './helpers/auth'

test.describe('Editor', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await createSession(page, 'Editor Test')
    await page.waitForSelector('.editor-container')
  })

  test('should open a file', async ({ page }) => {
    // Create a file
    await page.click('button:has-text("New File")')
    await page.fill('input[placeholder="filename"]', 'test.txt')
    await page.keyboard.press('Enter')

    // Click on the file
    await page.click('text=test.txt')

    await expect(page.locator('.monaco-editor')).toBeVisible()
  })

  test('should edit a file', async ({ page }) => {
    // Create and open a file
    await page.click('button:has-text("New File")')
    await page.fill('input[placeholder="filename"]', 'test.txt')
    await page.keyboard.press('Enter')
    await page.click('text=test.txt')

    // Wait for editor to be ready
    await page.waitForSelector('.monaco-editor')

    // Type in editor
    await page.keyboard.type('Hello World')

    // Check content
    const content = await page.locator('.monaco-editor textarea').inputValue()
    expect(content).toContain('Hello World')
  })

  test('should show file tree', async ({ page }) => {
    // Create some files
    const files = ['src/index.ts', 'src/App.tsx', 'package.json']

    for (const file of files) {
      await page.click('button:has-text("New File")')
      await page.fill('input[placeholder="filename"]', file)
      await page.keyboard.press('Enter')
    }

    // Check file tree
    await expect(page.locator('text=src')).toBeVisible()
    await expect(page.locator('text=index.ts')).toBeVisible()
    await expect(page.locator('text=App.tsx')).toBeVisible()
    await expect(page.locator('text=package.json')).toBeVisible()
  })

  test('should delete a file', async ({ page }) => {
    // Create and open a file
    await page.click('button:has-text("New File")')
    await page.fill('input[placeholder="filename"]', 'to-delete.txt')
    await page.keyboard.press('Enter')

    // Right click to open context menu
    await page.click('text=to-delete.txt', { button: 'right' })
    await page.click('text=Delete')

    // Confirm deletion
    await page.click('button:has-text("Delete")')

    await expect(page.locator('text=to-delete.txt')).not.toBeVisible()
  })
})
Collaboration Tests
typescript
// __tests__/e2e/collaboration.spec.ts
import { test, expect } from '@playwright/test'
import { login, createSession, joinSession } from './helpers/auth'

test.describe('Collaboration', () => {
  test('should show online users', async ({ browser }) => {
    // Create session with first user
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()
    await login(page1)
    await createSession(page1, 'Collab Test')
    const url = page1.url()
    const sessionId = url.split('/').pop()!

    // Join with second user
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    await login(page2)
    await joinSession(page2, sessionId)

    // Check user list on both pages
    await page1.click('text=Users')
    await page2.click('text=Users')

    await expect(page1.locator('text=Test User')).toBeVisible()
    await expect(page2.locator('text=Test User')).toBeVisible()
  })

  test('should sync cursor positions', async ({ browser }) => {
    // Create session with first user
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()
    await login(page1)
    await createSession(page1, 'Cursor Test')
    const url = page1.url()
    const sessionId = url.split('/').pop()!

    // Create a file and open it
    await page1.click('button:has-text("New File")')
    await page1.fill('input[placeholder="filename"]', 'test.txt')
    await page1.keyboard.press('Enter')
    await page1.click('text=test.txt')

    // Join with second user
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    await login(page2)
    await joinSession(page2, sessionId)

    // Open same file on second user
    await page2.click('text=test.txt')

    // Move cursor on first user
    await page1.click('.monaco-editor')
    await page1.keyboard.press('ArrowDown')
    await page1.keyboard.press('ArrowRight')

    // Wait for sync
    await page2.waitForTimeout(500)

    // Check that cursor is visible on second user
    const cursorDecoration = await page2.locator('.cursor-decoration-\\w+')
    await expect(cursorDecoration).toBeVisible()
  })

  test('should sync file changes in real-time', async ({ browser }) => {
    // Create session with first user
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()
    await login(page1)
    await createSession(page1, 'Sync Test')
    const url = page1.url()
    const sessionId = url.split('/').pop()!

    // Create and open a file
    await page1.click('button:has-text("New File")')
    await page1.fill('input[placeholder="filename"]', 'test.txt')
    await page1.keyboard.press('Enter')
    await page1.click('text=test.txt')

    // Join with second user
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    await login(page2)
    await joinSession(page2, sessionId)

    // Open same file on second user
    await page2.click('text=test.txt')

    // Type on first user
    await page1.click('.monaco-editor')
    await page1.keyboard.type('Hello from user 1!')

    // Wait for sync
    await page2.waitForTimeout(500)

    // Check content on second user
    const content2 = await page2.locator('.monaco-editor textarea').inputValue()
    expect(content2).toContain('Hello from user 1!')
  })

  test('should send and receive chat messages', async ({ browser }) => {
    // Create session with first user
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()
    await login(page1)
    await createSession(page1, 'Chat Test')
    const url = page1.url()
    const sessionId = url.split('/').pop()!

    // Join with second user
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    await login(page2)
    await joinSession(page2, sessionId)

    // Open chat on both pages
    await page1.click('text=Chat')
    await page2.click('text=Chat')

    // Send message from user 1
    await page1.fill('input[placeholder="Type a message..."]', 'Hello from user 1!')
    await page1.keyboard.press('Enter')

    // Wait for sync
    await page2.waitForTimeout(500)

    // Check message on user 2
    await expect(page2.locator('text=Hello from user 1!')).toBeVisible()
  })
})
```

### Chat Tests

```typescript
// __tests__/e2e/chat.spec.ts
import { test, expect } from '@playwright/test'
import { login, createSession } from './helpers/auth'

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await createSession(page, 'Chat Test')
    await page.click('text=Chat')
  })

  test('should send a chat message', async ({ page }) => {
    const input = page.locator('input[placeholder="Type a message (200 char max)..."]')
    const sendButton = page.locator('button:has-text("Send")')

    await input.fill('Hello world!')
    await sendButton.click()

    await expect(page.locator('text=Hello world!')).toBeVisible()
    await expect(input).toHaveValue('')
  })

  test('should show character limit', async ({ page }) => {
    const input = page.locator('input[placeholder="Type a message (200 char max)..."]')

    await input.fill('Hello')
    await expect(page.locator('text=5/200 characters')).toBeVisible()
  })

  test('should enforce 200 character limit', async ({ page }) => {
    const input = page.locator('input[placeholder="Type a message (200 char max)..."]')
    const longMessage = 'a'.repeat(250)

    await input.fill(longMessage)
    await expect(input).toHaveValue('a'.repeat(200))
  })

  test('should toggle mute', async ({ page }) => {
    const muteButton = page.locator('button:has-text("Mute")')

    await muteButton.click()
    await expect(muteButton).toContainText('Unmute')

    await muteButton.click()
    await expect(muteButton).toContainText('Mute')
  })
})
```

## 🧪 Test Data Management

### Test Data Fixtures

```typescript
// __tests__/e2e/fixtures/test-data.ts
import { test as base } from '@playwright/test'

type TestFixtures = {
  testUser: { email: string; password: string }
  testSession: { id: string; name: string }
}

export const test = base.extend<TestFixtures>({
  testUser: async ({}, use) => {
    const user = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPass123!'
    }
    await use(user)
  },

  testSession: async ({ page }, use) => {
    // Create a session and return its ID
    await page.goto('/sessions')
    await page.click('text=New Session')
    await page.fill('input[name="sessionName"]', 'Test Session')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/session\/.+/)

    const url = page.url()
    const sessionId = url.split('/').pop()!

    await use({ id: sessionId, name: 'Test Session' })
  }
})
```

## 📊 Running E2E Tests

### Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in headed mode
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e -- auth.spec.ts

# Run tests with debug mode
npm run test:e2e -- --debug

# Generate report
npm run test:e2e -- --reporter=html
npx playwright show-report
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

## 📊 Test Coverage

### Coverage Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  // ... existing config ...

  use: {
    // ... existing use config ...
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Coverage collection
  collectCoverage: true,
  coverageDirectory: 'coverage-e2e',
})
```

### Coverage Report

```bash
# Generate coverage report
npm run test:e2e -- --coverage

# Open coverage report
open coverage-e2e/index.html
```
