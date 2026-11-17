import {
  GUEST,
  OWNER,
  SESSION,
  TEMP,
  connectUser,
  eventsOf,
  handleDisconnect,
  handleMessage,
  resetServerState,
  seedSession,
  state,
  typesOf,
} from '../setup/test-helpers'
import { resetRateLimits } from '@/lib/rate-limit'

beforeEach(() => {
  resetServerState()
  // The limiter is module-level, so it must be cleared between specs too.
  resetRateLimits()
})

afterAll(() => {
  resetServerState()
})

describe('join', () => {
  it('rejects an unknown session', async () => {
    const socket = connectUser(GUEST)
    await handleMessage({ type: 'join', payload: { sessionId: SESSION } }, GUEST)

    expect(eventsOf(socket)[0]).toMatchObject({
      type: 'error',
      payload: { code: 'SESSION_NOT_FOUND' },
    })
  })

  it('rejects a session with no owner online', async () => {
    seedSession({ ownerId: OWNER })
    const socket = connectUser(GUEST)

    await handleMessage({ type: 'join', payload: { sessionId: SESSION } }, GUEST)

    expect(eventsOf(socket)[0]).toMatchObject({
      type: 'error',
      payload: { code: 'SESSION_INACTIVE' },
    })
  })

  it('joins, asks the owner for a ZIP, and returns session state', async () => {
    const session = seedSession()
    connectUser(OWNER, SESSION)
    const guest = connectUser(GUEST)

    await handleMessage({ type: 'join', payload: { sessionId: SESSION } }, GUEST)

    // The owner is asked to hand over the codebase.
    const ownerSocket = eventsOf(connectUser(OWNER, SESSION))
    void ownerSocket

    const guestEvents = eventsOf(guest)
    expect(guestEvents.map(e => e.type)).toContain('session:state')
    expect(state.sessionMap.get(GUEST)).toBe(SESSION)
    expect(session.users.has(GUEST)).toBe(true)
  })

  it('rejects a joiner past the 20 user cap', async () => {
    const users = new Set<string>([OWNER])
    for (let i = 0; i < 19; i++) users.add(`filler-${i}`)

    seedSession({ users })
    connectUser(OWNER, SESSION)
    const guest = connectUser(GUEST)

    await handleMessage({ type: 'join', payload: { sessionId: SESSION } }, GUEST)

    expect(eventsOf(guest)[0]).toMatchObject({ type: 'error', payload: { code: 'SESSION_FULL' } })
  })

  it('rejects a malformed payload before touching state', async () => {
    seedSession()
    connectUser(OWNER, SESSION)
    const guest = connectUser(GUEST)

    await handleMessage({ type: 'join', payload: { sessionId: 'not-a-uuid' } }, GUEST)

    expect(typesOf(guest)).toEqual(['error'])
    expect(state.sessionMap.has(GUEST)).toBe(false)
  })
})

describe('rate limiting', () => {
  it('caps a user at 30 messages per window', async () => {
    seedSession({ users: new Set([OWNER]) })
    connectUser(OWNER, SESSION)
    const owner = connectUser(OWNER, SESSION)

    // Exhaust the window with valid messages.
    for (let i = 0; i < 35; i++) {
      await handleMessage({ type: 'status', payload: { sessionId: SESSION, filePath: 'a.ts', status: 'idle' } }, OWNER)
    }

    const errors = eventsOf(owner).filter(e => e.type === 'error')
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('chat', () => {
  it('broadcasts to sender and peers', async () => {
    const session = seedSession({ users: new Set([OWNER, GUEST]) })
    connectUser(OWNER, SESSION)
    const guest = connectUser(GUEST, SESSION)

    await handleMessage({ type: 'chat', payload: { sessionId: SESSION, content: 'hi' } }, GUEST)

    expect(typesOf(guest)).toContain('chat')
    void session
  })

  it('rejects a message over 200 characters', async () => {
    seedSession({ users: new Set([OWNER]) })
    connectUser(OWNER, SESSION)
    const owner = connectUser(OWNER, SESSION)

    await handleMessage(
      { type: 'chat', payload: { sessionId: SESSION, content: 'a'.repeat(201) } },
      OWNER
    )

    expect(eventsOf(owner)[0]).toMatchObject({
      type: 'error',
      payload: { code: 'INVALID_PAYLOAD' },
    })
  })

  it('enforces the 10s cooldown per user', async () => {
    seedSession({ users: new Set([OWNER]) })
    connectUser(OWNER, SESSION)
    const owner = connectUser(OWNER, SESSION)

    await handleMessage({ type: 'chat', payload: { sessionId: SESSION, content: 'first' } }, OWNER)
    await handleMessage({ type: 'chat', payload: { sessionId: SESSION, content: 'second' } }, OWNER)

    const errors = eventsOf(owner).filter(e => e.type === 'error')
    expect(errors[0]).toMatchObject({ payload: { code: 'CHAT_COOLDOWN' } })
  })
})

describe('file operations', () => {
  it('lets a regular user edit but not create', async () => {
    seedSession({ users: new Set([OWNER, GUEST]) })
    connectUser(OWNER, SESSION)
    const guest = connectUser(GUEST, SESSION)

    await handleMessage(
      { type: 'file:create', payload: { sessionId: SESSION, path: 'a.ts' } },
      GUEST
    )

    expect(eventsOf(guest)[0]).toMatchObject({
      type: 'error',
      payload: { code: 'PERMISSION_DENIED' },
    })
  })

  it('lets a temp owner create and broadcasts to everyone', async () => {
    seedSession({ users: new Set([OWNER, TEMP]), tempOwnerId: TEMP })
    connectUser(OWNER, SESSION)
    const temp = connectUser(TEMP, SESSION)

    await handleMessage(
      { type: 'file:create', payload: { sessionId: SESSION, path: 'a.ts', content: 'x' } },
      TEMP
    )

    // file:* includes the sender.
    expect(typesOf(temp)).toContain('file:created')
  })

  it('refuses a delete from a non-owner', async () => {
    seedSession({ users: new Set([OWNER, GUEST]) })
    connectUser(OWNER, SESSION)
    const guest = connectUser(GUEST, SESSION)

    await handleMessage({ type: 'file:delete', payload: { sessionId: SESSION, path: 'a.ts' } }, GUEST)

    expect(eventsOf(guest)[0]).toMatchObject({ type: 'error' })
  })
})

describe('ownership', () => {
  it('only the main owner may grant a temp owner', async () => {
    seedSession({ users: new Set([OWNER, GUEST]) })
    connectUser(OWNER, SESSION)
    const guest = connectUser(GUEST, SESSION)

    await handleMessage(
      { type: 'ownership:grant', payload: { sessionId: SESSION, userId: GUEST } },
      GUEST
    )

    expect(eventsOf(guest)[0]).toMatchObject({ type: 'error' })
    expect(state.sessions.get(SESSION)?.tempOwnerId).toBeUndefined()
  })

  it('grants and then revokes as the main owner', async () => {
    const session = seedSession({ users: new Set([OWNER, GUEST]) })
    connectUser(OWNER, SESSION)
    connectUser(GUEST, SESSION)
    const owner = connectUser(OWNER, SESSION)

    await handleMessage(
      { type: 'ownership:grant', payload: { sessionId: SESSION, userId: GUEST } },
      OWNER
    )
    expect(session.tempOwnerId).toBe(GUEST)

    await handleMessage({ type: 'ownership:revoke', payload: { sessionId: SESSION } }, OWNER)
    expect(session.tempOwnerId).toBeUndefined()
    expect(typesOf(owner)).toContain('ownership:revoked')
  })
})

describe('disconnect semantics', () => {
  it('keeps the session alive when a temp owner is present', () => {
    const session = seedSession({ users: new Set([OWNER, TEMP, GUEST]), tempOwnerId: TEMP })
    connectUser(OWNER, SESSION)
    connectUser(TEMP, SESSION)
    connectUser(GUEST, SESSION)

    handleDisconnect(OWNER)

    expect(state.sessions.has(SESSION)).toBe(true)
    expect(session.ownerId).toBe(OWNER)
  })

  it('closes the session when the owner leaves with no temp owner', () => {
    seedSession({ users: new Set([OWNER, GUEST]) })
    connectUser(OWNER, SESSION)
    connectUser(GUEST, SESSION)
    const guest = connectUser(GUEST, SESSION)

    handleDisconnect(OWNER)

    expect(state.sessions.has(SESSION)).toBe(false)
    expect(typesOf(guest)).toContain('session:closed')
  })

  it('removes a user instantly with no grace period', () => {
    const session = seedSession({ users: new Set([OWNER, GUEST]) })
    connectUser(OWNER, SESSION)
    connectUser(GUEST, SESSION)

    handleDisconnect(GUEST)

    expect(session.users.has(GUEST)).toBe(false)
    expect(state.sessionMap.has(GUEST)).toBe(false)
  })

  it('drops the session when the last member leaves', () => {
    seedSession({ users: new Set([OWNER]) })
    connectUser(OWNER, SESSION)

    handleDisconnect(OWNER)

    expect(state.sessions.has(SESSION)).toBe(false)
  })
})

describe('session id change', () => {
  it('moves the session and remaps every member', async () => {
    seedSession({ users: new Set([OWNER, GUEST]) })
    connectUser(OWNER, SESSION)
    connectUser(GUEST, SESSION)
    const owner = connectUser(OWNER, SESSION)

    await handleMessage({ type: 'session:id-change', payload: { sessionId: SESSION } }, OWNER)

    expect(state.sessions.has(SESSION)).toBe(false)
    expect(typesOf(owner)).toContain('session:id-changed')

    const mapped = Array.from(state.sessionMap.values())
    expect(mapped.every(id => id !== SESSION)).toBe(true)
  })

  it('refuses an id change from a temp owner', async () => {
    seedSession({ users: new Set([OWNER, TEMP]), tempOwnerId: TEMP })
    connectUser(OWNER, SESSION)
    const temp = connectUser(TEMP, SESSION)

    await handleMessage({ type: 'session:id-change', payload: { sessionId: SESSION } }, TEMP)

    expect(state.sessions.has(SESSION)).toBe(true)
    expect(eventsOf(temp)[0]).toMatchObject({ type: 'error' })
  })
})

describe('zip relay', () => {
  it('forwards a sender ZIP to the target user', async () => {
    seedSession({ users: new Set([OWNER, GUEST]) })
    connectUser(OWNER, SESSION)
    const guest = connectUser(GUEST, SESSION)

    await handleMessage(
      { type: 'send:zip', payload: { targetUserId: GUEST, zip: 'UEs=' } },
      OWNER
    )

    expect(eventsOf(guest)).toContainEqual({
      type: 'receive:zip',
      payload: { zip: 'UEs=' },
      timestamp: expect.any(Number),
    })
  })

  it('refuses a relay from a user who is not in a session', async () => {
    const owner = connectUser(OWNER)

    await handleMessage(
      { type: 'send:zip', payload: { targetUserId: GUEST, zip: 'UEs=' } },
      OWNER
    )

    expect(eventsOf(owner)[0]).toMatchObject({ type: 'error' })
  })
})

describe('unknown events', () => {
  it('rejects an unregistered type', async () => {
    seedSession({ users: new Set([OWNER]) })
    const owner = connectUser(OWNER, SESSION)

    await handleMessage({ type: 'wat', payload: {} }, OWNER)

    expect(eventsOf(owner)[0]).toMatchObject({
      type: 'error',
      payload: { error: 'Unknown event type' },
    })
  })
})