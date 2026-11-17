import { Permission, checkFilePermission, checkPermission, getUserRole } from '@/lib/websocket/permissions'
import { resetServerState, state, type ActiveSession } from '@/lib/websocket/state'
import type { SocketLike } from '@/lib/websocket/types'
import { SOCKET_OPEN } from '@/lib/websocket/types'

const OWNER = '11111111-1111-4111-8111-111111111111'
const TEMP = '22222222-2222-4222-8222-222222222222'
const GUEST = '33333333-3333-4333-8333-333333333333'
const SESSION = '44444444-4444-4444-8444-444444444444'

function makeSocket(): SocketLike & { sent: string[] } {
  const sent: string[] = []
  return {
    readyState: SOCKET_OPEN,
    sent,
    send(data: string) {
      sent.push(data)
    },
    close() {
      /* no-op */
    },
  }
}

function seed(users: string[] = [OWNER, TEMP, GUEST]): void {
  const session: ActiveSession = {
    id: SESSION,
    name: 'Test',
    ownerId: OWNER,
    tempOwnerId: TEMP,
    users: new Set(users),
    isSaved: false,
    createdAt: new Date(),
  }

  state.sessions.set(SESSION, session)

  for (const userId of users) {
    state.connections.set(userId, makeSocket())
  }
}

beforeEach(() => {
  resetServerState()
})

afterAll(() => {
  resetServerState()
})

describe('checkPermission', () => {
  it('allows the owner everything', () => {
    seed()

    const permissions = [
      Permission.CREATE_FILE,
      Permission.DELETE_FILE,
      Permission.RENAME_FILE,
      Permission.EDIT_FILE,
      Permission.SAVE_SESSION,
      Permission.EXPORT_SESSION,
      Permission.CHANGE_SESSION_ID,
      Permission.GRANT_TEMP_OWNER,
      Permission.REVOKE_TEMP_OWNER,
      Permission.CLOSE_SESSION,
      Permission.VIEW_FILES,
      Permission.CHAT,
    ]

    for (const permission of permissions) {
      expect(checkPermission(SESSION, OWNER, permission).allowed).toBe(true)
    }
  })

  it('lets a temp owner edit files but not save, export or regrant', () => {
    seed()

    expect(checkPermission(SESSION, TEMP, Permission.CREATE_FILE).allowed).toBe(true)
    expect(checkPermission(SESSION, TEMP, Permission.DELETE_FILE).allowed).toBe(true)
    expect(checkPermission(SESSION, TEMP, Permission.RENAME_FILE).allowed).toBe(true)
    expect(checkPermission(SESSION, TEMP, Permission.EDIT_FILE).allowed).toBe(true)

    expect(checkPermission(SESSION, TEMP, Permission.SAVE_SESSION).allowed).toBe(false)
    expect(checkPermission(SESSION, TEMP, Permission.EXPORT_SESSION).allowed).toBe(false)
    expect(checkPermission(SESSION, TEMP, Permission.CHANGE_SESSION_ID).allowed).toBe(false)
    expect(checkPermission(SESSION, TEMP, Permission.GRANT_TEMP_OWNER).allowed).toBe(false)
    expect(checkPermission(SESSION, TEMP, Permission.REVOKE_TEMP_OWNER).allowed).toBe(false)
  })

  it('lets a regular user edit and view but not create files', () => {
    seed()

    expect(checkPermission(SESSION, GUEST, Permission.EDIT_FILE).allowed).toBe(true)
    expect(checkPermission(SESSION, GUEST, Permission.VIEW_FILES).allowed).toBe(true)
    expect(checkPermission(SESSION, GUEST, Permission.CHAT).allowed).toBe(true)

    expect(checkPermission(SESSION, GUEST, Permission.CREATE_FILE).allowed).toBe(false)
    expect(checkPermission(SESSION, GUEST, Permission.DELETE_FILE).allowed).toBe(false)
    expect(checkPermission(SESSION, GUEST, Permission.SAVE_SESSION).allowed).toBe(false)
  })

  it('stops a temp owner closing while the main owner is online', () => {
    seed()

    const result = checkPermission(SESSION, TEMP, Permission.CLOSE_SESSION)
    expect(result.allowed).toBe(false)
    expect(result.error).toMatch(/main owner is online/i)
  })

  it('lets a temp owner close once the main owner is offline', () => {
    seed([TEMP, GUEST])

    expect(checkPermission(SESSION, TEMP, Permission.CLOSE_SESSION).allowed).toBe(true)
  })

  it('rejects a non-member even if the ids line up', () => {
    seed([OWNER])

    expect(checkPermission(SESSION, GUEST, Permission.EDIT_FILE).allowed).toBe(false)
  })

  it('rejects an unknown session', () => {
    expect(checkPermission('does-not-exist', OWNER, Permission.EDIT_FILE)).toEqual({
      allowed: false,
      error: 'Session not found',
    })
  })
})

describe('checkFilePermission', () => {
  it('covers every file operation for owner and temp owner', () => {
    seed()

    for (const operation of ['create', 'delete', 'rename', 'move'] as const) {
      expect(checkFilePermission(SESSION, OWNER, operation).allowed).toBe(true)
      expect(checkFilePermission(SESSION, TEMP, operation).allowed).toBe(true)
      expect(checkFilePermission(SESSION, GUEST, operation).allowed).toBe(false)
    }
  })
})

describe('getUserRole', () => {
  it('maps ids to roles', () => {
    seed()

    expect(getUserRole(SESSION, OWNER)).toBe('owner')
    expect(getUserRole(SESSION, TEMP)).toBe('temp_owner')
    expect(getUserRole(SESSION, GUEST)).toBe('user')
  })
})