import {
  isSafeFilePath,
  validateFileContent,
  validateFileName,
  validateFilePath,
} from '@/lib/file-system/security'
import {
  buildTree,
  createFileNode,
  deleteFileNode,
  findNode,
  renameFileNode,
  treeToMap,
} from '@/lib/file-system/helpers'
import { validateEmail, validatePassword } from '@/lib/auth/password'
import { getContrastColor, getUserColor, lightenColor } from '@/lib/colors'

describe('path validation (rejects, never sanitizes)', () => {
  it('rejects traversal', () => {
    expect(isSafeFilePath('../etc/passwd')).toBe(false)
    expect(isSafeFilePath('a/../../b')).toBe(false)
    expect(validateFilePath('foo/../bar')).toBe(false)
  })

  it('rejects absolute paths', () => {
    expect(isSafeFilePath('/etc/passwd')).toBe(false)
    expect(isSafeFilePath('\\windows\\system32')).toBe(false)
    expect(isSafeFilePath('C:/secrets')).toBe(false)
  })

  it('rejects backslash separators', () => {
    expect(isSafeFilePath('src\\index.ts')).toBe(false)
  })

  it('accepts ordinary relative paths', () => {
    expect(isSafeFilePath('src/index.ts')).toBe(true)
    expect(isSafeFilePath('README.md')).toBe(true)
    expect(isSafeFilePath('a/b/c/d.txt')).toBe(true)
  })

  it('rejects file names containing separators or traversal', () => {
    expect(validateFileName('index.ts')).toBe(true)
    expect(validateFileName('a/b.ts')).toBe(false)
    expect(validateFileName('..')).toBe(false)
    expect(validateFileName('x'.repeat(256))).toBe(false)
  })
})

describe('validateFileContent', () => {
  it('rejects binary content', () => {
    expect(validateFileContent('const a = 1')).toBe(true)
    expect(validateFileContent('const a = 1\u0000rest')).toBe(false)
  })

  it('accepts suspicious-looking text but still returns true', () => {
    expect(validateFileContent('<script>alert(1)</script>')).toBe(true)
    expect(validateFileContent('onclick="x()"')).toBe(true)
  })
})

describe('file tree helpers', () => {
  it('builds a nested tree from a flat map', () => {
    const tree = buildTree({
      'src/index.ts': 'export const a = 1',
      'src/lib/util.ts': 'export const b = 2',
      'README.md': '# hi',
    })

    const src = findNode(tree, 'src')
    expect(src?.type).toBe('folder')
    expect(src?.children).toHaveLength(2)

    expect(treeToMap(tree)).toEqual({
      'src/index.ts': 'export const a = 1',
      'src/lib/util.ts': 'export const b = 2',
      'README.md': '# hi',
    })
  })

  it('sorts folders before files, then alphabetically', () => {
    const tree = buildTree({ 'z.ts': '', 'src/a.ts': '', 'a.ts': '' })
    expect(tree.map(node => node.name)).toEqual(['src', 'a.ts', 'z.ts'])
  })

  it('applies first-one-wins on duplicate create', () => {
    const first = createFileNode([], 'a.ts', 'first')
    const second = createFileNode(first, 'a.ts', 'second')

    expect(findNode(second, 'a.ts')?.content).toBe('first')
    expect(second).toBe(first)
  })

  it('creates folders', () => {
    const tree = createFileNode([], 'src', '', 'folder')
    expect(findNode(tree, 'src')?.type).toBe('folder')
  })

  it('deletes a file and its contents', () => {
    const tree = buildTree({ 'src/a.ts': 'x' })
    const deleted = deleteFileNode(tree, 'src/a.ts')

    expect(findNode(deleted, 'src/a.ts')).toBeUndefined()
    expect(treeToMap(deleted)).toEqual({})
  })

  it('renames a file', () => {
    const tree = buildTree({ 'a.ts': 'content' })
    const renamed = renameFileNode(tree, 'a.ts', 'b.ts')

    expect(findNode(renamed, 'a.ts')).toBeUndefined()
    expect(findNode(renamed, 'b.ts')?.content).toBe('content')
    expect(findNode(renamed, 'b.ts')?.extension).toBe('ts')
  })

  it('rebases descendants when a folder is renamed', () => {
    const tree = buildTree({ 'src/a.ts': 'x', 'src/deep/b.ts': 'y' })
    const renamed = renameFileNode(tree, 'src', 'lib')

    expect(findNode(renamed, 'lib/deep/b.ts')?.content).toBe('y')
    expect(treeToMap(renamed)).toEqual({ 'lib/a.ts': 'x', 'lib/deep/b.ts': 'y' })
  })
})

describe('password policy', () => {
  it('accepts a compliant password', () => {
    expect(validatePassword('Password123')).toEqual({ valid: true, errors: [] })
  })

  it.each([
    ['short', 'Pa1', /at least 8/],
    ['no uppercase', 'password1', /uppercase/],
    ['no lowercase', 'PASSWORD1', /lowercase/],
    ['no digit', 'Password', /number/],
  ])('rejects %s', (_label, password, pattern) => {
    const result = validatePassword(password)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(pattern)
  })

  it('rejects passwords over 100 characters', () => {
    expect(validatePassword(`${'A1a'.repeat(40)}`).valid).toBe(false)
  })

  it('accumulates every failure at once', () => {
    const result = validatePassword('abc')
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

describe('email validation', () => {
  it.each(['a@b.co', 'first.last@sub.domain.io'])('accepts %s', email => {
    expect(validateEmail(email)).toBe(true)
  })

  it.each(['invalid', 'test@', '@domain.com', 'test@domain', 'a b@c.com'])(
    'rejects %s',
    email => {
      expect(validateEmail(email)).toBe(false)
    }
  )
})

describe('user colors', () => {
  it('is deterministic per user and differs between users', () => {
    expect(getUserColor('user-1')).toBe(getUserColor('user-1'))
    expect(getUserColor('user-1')).not.toBe(getUserColor('user-2'))
  })

  it('picks a readable contrast color', () => {
    expect(getContrastColor('#ffffff')).toBe('#0d1117')
    expect(getContrastColor('#000000')).toBe('#ffffff')
  })

  it('lightens without overflowing the channel', () => {
    expect(lightenColor('#ffffff', 50)).toBe('#ffffff')
  })
})