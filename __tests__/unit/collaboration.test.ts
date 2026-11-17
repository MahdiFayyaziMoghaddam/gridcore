import JSZip from 'jszip'
import { createZip, extractZip } from '@/lib/storage/zip'
import { isSafeFilePath } from '@/lib/file-system/security'
import {
  applyRemoteUpdate,
  createFile,
  deleteFile,
  destroyDocument,
  encodeState,
  getFileContent,
  getFilePaths,
  getSessionSnapshot,
  loadFilesIntoYjs,
  observeFile,
  observeUpdates,
  setFileContent,
} from '@/lib/collaboration/yjs'

const SESSION = 'session-a'
const OTHER = 'session-b'

afterEach(() => {
  destroyDocument(SESSION)
  destroyDocument(OTHER)
})

describe('yjs document', () => {
  it('stores files at file:<path> and lists them back', () => {
    createFile(SESSION, 'src/index.ts', 'export const a = 1')
    createFile(SESSION, 'README.md', '# hi')

    expect(getFilePaths(SESSION).sort()).toEqual(['README.md', 'src/index.ts'])
    expect(getFileContent(SESSION, 'src/index.ts')).toBe('export const a = 1')
  })

  it('is first-one-wins on simultaneous create', () => {
    expect(createFile(SESSION, 'a.ts', 'first')).toBe(true)
    expect(createFile(SESSION, 'a.ts', 'second')).toBe(false)
    expect(getFileContent(SESSION, 'a.ts')).toBe('first')
  })

  it('replaces content wholesale', () => {
    createFile(SESSION, 'a.ts', 'old content')
    setFileContent(SESSION, 'a.ts', 'new')
    expect(getFileContent(SESSION, 'a.ts')).toBe('new')
  })

  it('empties a file on delete but keeps the path known', () => {
    createFile(SESSION, 'gone.ts', 'x')
    deleteFile(SESSION, 'gone.ts')
    expect(getFileContent(SESSION, 'gone.ts')).toBe('')
  })

  it('keeps sessions isolated', () => {
    createFile(SESSION, 'a.ts', 'in-a')
    createFile(OTHER, 'a.ts', 'in-b')

    expect(getFileContent(SESSION, 'a.ts')).toBe('in-a')
    expect(getFileContent(OTHER, 'a.ts')).toBe('in-b')
  })

  it('produces a snapshot of every file', () => {
    loadFilesIntoYjs(SESSION, { 'a.ts': 'A', 'b.ts': 'B' })
    expect(getSessionSnapshot(SESSION)).toEqual({ 'a.ts': 'A', 'b.ts': 'B' })
  })
})

describe('yjs observers', () => {
  it('reports the changed path and content', () => {
    const seen: [string, string][] = []
    observeFile(SESSION, (path, content) => seen.push([path, content]))

    setFileContent(SESSION, 'a.ts', 'hello')

    expect(seen).toContainEqual(['a.ts', 'hello'])
  })

  it('stops reporting after unsubscribe', () => {
    const seen: string[] = []
    const stop = observeFile(SESSION, path => seen.push(path))

    setFileContent(SESSION, 'a.ts', 'one')
    stop()
    setFileContent(SESSION, 'a.ts', 'two')

    expect(seen).toEqual(['a.ts'])
  })

  it('notifies a late subscriber about pre-existing files', () => {
    createFile(SESSION, 'existing.ts', 'x')

    const seen: string[] = []
    observeFile(SESSION, path => seen.push(path))
    setFileContent(SESSION, 'existing.ts', 'y')

    expect(seen).toEqual(['existing.ts'])
  })
})

describe('CRDT update transport', () => {
  it('replicates an edit between two documents', () => {
    createFile(SESSION, 'shared.ts', 'base')

    // A joining client is seeded with the owner's full state, history included.
    applyRemoteUpdate(OTHER, encodeState(SESSION))
    expect(getFileContent(OTHER, 'shared.ts')).toBe('base')

    const updates: Uint8Array[] = []
    observeUpdates(SESSION, (_paths, update) => updates.push(update))

    setFileContent(SESSION, 'shared.ts', 'base + edit')

    expect(updates.length).toBeGreaterThan(0)
    for (const update of updates) applyRemoteUpdate(OTHER, update)

    expect(getFileContent(OTHER, 'shared.ts')).toBe('base + edit')
  })

  it('does not re-emit an update it just applied from a peer', () => {
    createFile(SESSION, 'a.ts', 'x')
    applyRemoteUpdate(OTHER, encodeState(SESSION))

    const outgoing: Uint8Array[] = []
    const stopSender = observeUpdates(SESSION, (_paths, update) => outgoing.push(update))
    setFileContent(SESSION, 'a.ts', 'changed')
    stopSender()

    expect(outgoing.length).toBeGreaterThan(0)

    const emitted: string[][] = []
    const stopReceiver = observeUpdates(OTHER, paths => emitted.push(paths))

    for (const update of outgoing) applyRemoteUpdate(OTHER, update)

    expect(getFileContent(OTHER, 'a.ts')).toBe('changed')
    expect(emitted).toEqual([])

    stopReceiver()
  })
})

describe('zip round trip', () => {
  it('preserves content through create then extract', async () => {
    const blob = await createZip({ 'a.ts': 'alpha', 'src/b.ts': 'beta' })

    const { files, errors } = await extractZip(blob)

    expect(errors).toEqual([])
    expect(files).toEqual({ 'a.ts': 'alpha', 'src/b.ts': 'beta' })
  })

  it('skips binary entries instead of failing the import', async () => {
    const zip = new JSZip()
    zip.file('text.ts', 'hello')
    zip.file('image.png', new Uint8Array([0x89, 0x50, 0x00, 0x01]))

    const blob = await zip.generateAsync({ type: 'blob' })
    const { files, errors } = await extractZip(blob)

    expect(errors).toEqual([])
    expect(Object.keys(files)).toEqual(['text.ts'])
  })

  it('never lets an extracted key escape the tree', async () => {
    // JSZip normalises hostile names on write, so assert the invariant that
    // matters rather than a specific error.
    const zip = new JSZip()
    zip.file('../escape.txt', 'nope')
    zip.file('/absolute.txt', 'nope')

    const blob = await zip.generateAsync({ type: 'blob' })
    const { files } = await extractZip(blob)

    for (const path of Object.keys(files)) {
      expect(isSafeFilePath(path)).toBe(true)
    }
  })

  it('errors on an empty archive', async () => {
    const blob = await createZip({})
    const { files, errors } = await extractZip(blob)

    expect(files).toEqual({})
    expect(errors[0]?.code).toBe('EMPTY')
  })

  it('errors on a zero-byte blob', async () => {
    const { errors } = await extractZip(new Blob([]))
    expect(errors[0]?.code).toBe('EMPTY')
  })

  it('errors on a corrupt archive', async () => {
    const { errors } = await extractZip(new Blob(['not a zip at all']))
    expect(errors[0]?.code).toBe('CORRUPTED')
  })

  it('warns about sensitive paths without blocking', async () => {
    const blob = await createZip({ '.env': 'SECRET=1' })
    const { files, warnings } = await extractZip(blob)

    expect(files['.env']).toBe('SECRET=1')
    expect(warnings.join(' ')).toContain('.env')
  })
})