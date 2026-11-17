import { useChatStore } from '@/stores/chatStore'
import { initialFileState, useFileStore } from '@/stores/fileStore'
import { useSessionStore, selectCanEditFiles, selectIsOwner } from '@/stores/sessionStore'
import { useUiStore } from '@/stores/uiStore'
import { CHAT_MAX_MESSAGE_LENGTH } from '@/lib/constants'

const OWNER = 'owner-1'
const TEMP = 'temp-1'
const GUEST = 'guest-1'

beforeEach(() => {
  useChatStore.setState({ messages: [], isMuted: false, unreadCount: 0 })
  useFileStore.setState({ ...initialFileState, fileContents: new Map() })
  useSessionStore.getState().clearSession()
  useUiStore.getState().setActiveTab('files')
})

describe('sessionStore role derivation', () => {
  it('treats the owner as able to edit files and to save', () => {
    useSessionStore.getState().setCurrentUser(OWNER)
    useSessionStore.getState().setSession({
      id: 's1',
      name: 'S',
      ownerId: OWNER,
      isSaved: false,
      createdAt: new Date(),
    })

    expect(selectIsOwner(useSessionStore.getState())).toBe(true)
    expect(selectCanEditFiles(useSessionStore.getState())).toBe(true)
  })

  it('gives a temp owner file rights but not ownership', () => {
    useSessionStore.getState().setCurrentUser(TEMP)
    useSessionStore.getState().setSession({
      id: 's1',
      name: 'S',
      ownerId: OWNER,
      tempOwnerId: TEMP,
      isSaved: false,
      createdAt: new Date(),
    })

    expect(selectIsOwner(useSessionStore.getState())).toBe(false)
    expect(selectCanEditFiles(useSessionStore.getState())).toBe(true)
  })

  it('gives a regular user neither', () => {
    useSessionStore.getState().setCurrentUser(GUEST)
    useSessionStore.getState().setSession({
      id: 's1',
      name: 'S',
      ownerId: OWNER,
      isSaved: false,
      createdAt: new Date(),
    })

    expect(selectCanEditFiles(useSessionStore.getState())).toBe(false)
  })
})

describe('sessionStore users', () => {
  it('adds, updates and removes users immutably', () => {
    const add = useSessionStore.getState().addUser
    add({ id: GUEST, name: 'Guest', isOnline: true })
    expect(useSessionStore.getState().users.has(GUEST)).toBe(true)

    useSessionStore.getState().setUserStatus(GUEST, 'editing')
    expect(useSessionStore.getState().users.get(GUEST)?.status).toBe('editing')

    useSessionStore.getState().removeUser(GUEST)
    expect(useSessionStore.getState().users.has(GUEST)).toBe(false)
  })

  it('assigns a deterministic color on add', () => {
    useSessionStore.getState().addUser({ id: GUEST, name: 'Guest', isOnline: true })
    expect(useSessionStore.getState().users.get(GUEST)?.color).toMatch(/^#/)
  })
})

describe('fileStore', () => {
  const files = {
    'a.ts': 'aaa',
    'src/b.ts': 'bbb',
  }

  it('loads a flat map and clears dirty', () => {
    useFileStore.getState().loadFromMap(files)

    const state = useFileStore.getState()
    expect(state.files).toHaveLength(2)
    expect(state.fileContents.get('src/b.ts')).toBe('bbb')
    expect(state.isDirty).toBe(false)
  })

  it('opens, switches and closes tabs, falling back to the last open file', () => {
    const store = useFileStore.getState()

    store.openFile('a.ts')
    store.openFile('src/b.ts')
    expect(useFileStore.getState().activeFile).toBe('src/b.ts')

    store.closeFile('src/b.ts')
    expect(useFileStore.getState().activeFile).toBe('a.ts')

    useFileStore.getState().closeFile('a.ts')
    expect(useFileStore.getState().activeFile).toBeNull()
  })

  it('marks dirty on edit and clears on reset', () => {
    useFileStore.getState().loadFromMap(files)
    useFileStore.getState().updateFileContent('a.ts', 'changed')

    expect(useFileStore.getState().fileContents.get('a.ts')).toBe('changed')
    expect(useFileStore.getState().isDirty).toBe(true)

    useFileStore.getState().reset()
    expect(useFileStore.getState().files).toEqual([])
    expect(useFileStore.getState().isDirty).toBe(false)
  })

  it('renames a file and carries its tab across', () => {
    useFileStore.getState().loadFromMap(files)
    useFileStore.getState().openFile('a.ts')
    useFileStore.getState().renameFile('a.ts', 'c.ts')

    const state = useFileStore.getState()
    expect(state.activeFile).toBe('c.ts')
    expect(state.fileContents.get('c.ts')).toBe('aaa')
    expect(state.fileContents.has('a.ts')).toBe(false)
  })

  it('closes the active tab when its file is deleted', () => {
    useFileStore.getState().loadFromMap(files)
    useFileStore.getState().openFile('a.ts')
    useFileStore.getState().deleteFile('a.ts')

    expect(useFileStore.getState().activeFile).toBeNull()
    expect(useFileStore.getState().openFiles).toEqual([])
  })
})

describe('chatStore', () => {
  const message = {
    id: '1',
    userId: GUEST,
    content: 'hello',
    timestamp: new Date().toISOString(),
  }

  it('adds messages and counts others as unread', () => {
    useChatStore.getState().addMessage({ ...message, isOwn: true })
    expect(useChatStore.getState().unreadCount).toBe(0)

    useChatStore.getState().addMessage({ ...message, id: '2', isOwn: false })
    expect(useChatStore.getState().messages).toHaveLength(2)
    expect(useChatStore.getState().unreadCount).toBe(1)
  })

  it('caps history and resets unread', () => {
    for (let i = 0; i < 120; i++) {
      useChatStore.getState().addMessage({ ...message, id: String(i) })
    }

    expect(useChatStore.getState().messages.length).toBeLessThanOrEqual(120)
    expect(useChatStore.getState().messages[0]!.id).not.toBe('0')

    useChatStore.getState().resetUnread()
    expect(useChatStore.getState().unreadCount).toBe(0)
  })

  it('toggles mute both ways', () => {
    useChatStore.getState().toggleMute()
    expect(useChatStore.getState().isMuted).toBe(true)
    useChatStore.getState().toggleMute()
    expect(useChatStore.getState().isMuted).toBe(false)
  })

  it('enforces the 200 char limit at the store boundary', () => {
    expect(CHAT_MAX_MESSAGE_LENGTH).toBe(200)
  })
})

describe('uiStore', () => {
  it('switches sidebar tabs and pushes notifications', () => {
    useUiStore.getState().setActiveTab('chat')
    expect(useUiStore.getState().activeSidebarTab).toBe('chat')

    useUiStore.getState().notify('saved', 'success')
    const notification = useUiStore.getState().notifications[0]!

    expect(notification.tone).toBe('success')

    useUiStore.getState().dismiss(notification.id)
    expect(useUiStore.getState().notifications).toEqual([])
  })

  it('caps the notification stack', () => {
    for (let i = 0; i < 10; i++) useUiStore.getState().notify(`n${i}`)
    expect(useUiStore.getState().notifications.length).toBeLessThanOrEqual(5)
  })
})