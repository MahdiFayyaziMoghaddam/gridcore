// ─────────────────────────────────────────────────────────────
// Session limits
// ─────────────────────────────────────────────────────────────
export const MAX_USERS_PER_SESSION = 20
export const MAX_SAVED_SESSIONS_PER_USER = 3
export const MAX_SESSION_NAME_LENGTH = 50
export const SESSION_NAME_FALLBACK_PREFIX = 'new-session-'

// ─────────────────────────────────────────────────────────────
// File & storage limits
// ─────────────────────────────────────────────────────────────
export const MAX_ZIP_SIZE = 50 * 1024 * 1024 // 50MB
export const MAX_SINGLE_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_FILE_NAME_LENGTH = 255
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB
export const ZIP_CHUNK_SIZE = 1024 * 1024 // 1MB
export const ZIP_BATCH_SIZE = 100
export const STORAGE_PATH_PREFIX = '/sessions'
export const STORAGE_CONTENT_TYPE = 'application/zip'

// ─────────────────────────────────────────────────────────────
// Chat limits
// ─────────────────────────────────────────────────────────────
export const CHAT_MAX_MESSAGE_LENGTH = 200
export const CHAT_COOLDOWN = 10 * 1000 // 10s
export const MAX_CHAT_HISTORY = 100

// ─────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────
export const RATE_LIMIT_WINDOW_MS = 60 * 1000
export const RATE_LIMIT_MAX_REQUESTS = 30

// ─────────────────────────────────────────────────────────────
// Network
// ─────────────────────────────────────────────────────────────
export const MAX_WS_MESSAGE_SIZE = 1024 * 1024 // 1MB
export const WS_PING_INTERVAL = 30 * 1000
export const WS_RATELIMIT_CLEANUP_INTERVAL = 30 * 1000
export const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000
export const RECONNECT_DELAY = 3000

// ─────────────────────────────────────────────────────────────
// Debounce / batching
// ─────────────────────────────────────────────────────────────
export const CURSOR_DEBOUNCE_MS = 100
export const STATUS_DEBOUNCE_MS = 500
export const FILE_CONTENT_DEBOUNCE_MS = 300
export const DIFF_BATCH_SIZE = 10
export const DIFF_BATCH_DELAY_MS = 100
export const BROADCAST_BATCH_DELAY_MS = 100

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────
export const BCRYPT_SALT_ROUNDS = 10
export const JWT_MAX_AGE = 24 * 60 * 60 // 24 hours
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 100
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─────────────────────────────────────────────────────────────
// Editor
// ─────────────────────────────────────────────────────────────
export const EDITOR_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'html',
  'css',
  'json',
  'markdown',
  'plaintext',
] as const

export const EDITOR_FONT_SIZE = 14
export const EDITOR_TAB_SIZE = 2
export const EDITOR_FONT_FAMILY = 'JetBrains Mono, Fira Code, monospace'

// ─────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────
export const SIDEBAR_MIN_WIDTH = 240
export const SIDEBAR_MAX_WIDTH = 480
export const SIDEBAR_DEFAULT_WIDTH = 240
export const NAVBAR_HEIGHT = 40
export const STATUSBAR_HEIGHT = 24
export const FILE_TREE_ROW_HEIGHT = 24

// ─────────────────────────────────────────────────────────────
// Presence
// ─────────────────────────────────────────────────────────────
export type PresenceStatus = 'online' | 'idle' | 'editing' | 'away'
export type ActivityStatus = 'idle' | 'editing' | 'viewing'

export const MULTI_TAB_MESSAGE = 'You already have GridCore open'
export const MULTI_TAB_STORAGE_KEY = 'gridcore:tab-id'

// ─────────────────────────────────────────────────────────────
// Storage paths (warn-only during import, never blocks)
// ─────────────────────────────────────────────────────────────
export const SENSITIVE_PATH_SEGMENTS = ['.env', '.git', 'node_modules'] as const

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i