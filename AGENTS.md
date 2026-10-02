# AGENTS.md

Operating manual for coding agents working on **GridCore**.

> The repo currently contains **specification only** (`docs/`, 38 files). No `package.json`, no source.
> Everything below is the contract to build against. When code and this file disagree, this file wins —
> and if a doc contradicts itself, the "Doc contradictions" section at the bottom tells you which side to pick.

---

## 1. What GridCore is

Real-time multiplayer web IDE. Users share a codebase and edit it together (pair programming, teaching, interviews).

**The one architectural idea that governs everything else:**

> **Clients hold the state. The server is a message broker with a role-checker.**
> The server never stores file contents. It authenticates, checks permission, and broadcasts.

If a change makes the server remember file content, it is wrong.

---

## 2. Stack (fixed — do not substitute)

| Layer | Choice |
| --- | --- |
| Framework | Next.js **14**, App Router |
| Language | TypeScript, `strict: true` |
| UI | React 18, Tailwind 3, **shadcn/ui**, lucide-react |
| Editor | `@monaco-editor/react` (lazy-loaded, `ssr: false`) |
| Realtime | `yjs` 13 (CRDT) + `ws` 8 over the WebSocket route |
| Auth | NextAuth 4 — credentials (bcrypt) + GitHub + Google, JWT 24h |
| DB | PostgreSQL + Drizzle ORM 0.29 (`vercel-postgres` driver) |
| Storage | Vercel Blob, private, base64 ZIP in JSON bodies |
| Client state | Zustand 4 |
| Validation | Zod at trust boundaries (WS payloads, API bodies, env) |
| Tests | Jest 29 (unit jsdom / integration node) + Playwright (e2e) |
| Host | Vercel |

---

## 3. Hard limits (non-negotiable, enforced in docs at these exact values)

```
MAX_USERS_PER_SESSION      = 20
MAX_SAVED_SESSIONS_PER_USER= 3
MAX_ZIP_SIZE               = 50 * 1024 * 1024   (50MB)
MAX_SINGLE_FILE            = 10 * 1024 * 1024   (10MB)
MAX_FILE_NAME_LENGTH       = 255
CHAT_MAX_MESSAGE_LENGTH    = 200
CHAT_COOLDOWN              = 10 * 1000          (10s)
RATE_LIMIT                 = { windowMs: 60_000, maxRequests: 30 }
MAX_DOCUMENT_SIZE (yjs)    = 10 * 1024 * 1024
WS message size            = 1MB
```

Other invariants: session IDs are **UUID v4**; `POSTGRES` over SSL; WSS in production; bcrypt cost **10**; JWT expires in **24h**; dark theme only; **one tab per user** (blocked via LocalStorage + WS check, message `"You already have GridCore open"`).

---

## 4. Permission model (get this exactly right)

Three roles. `checkPermission(sessionId, userId, permission)` in `lib/websocket/permissions.ts` is the single source of truth — server and client both route through it. Never hand-roll an `isOwner &&` check.

| Action | Main Owner | Temp Owner | Regular User |
| --- | :---: | :---: | :---: |
| Create session | ✅ | ❌ | ❌ |
| Join / leave | ✅ | ✅ | ✅ |
| View files, chat | ✅ | ✅ | ✅ |
| Edit files | ✅ | ✅ | ✅ |
| Create / delete / rename files | ✅ | ✅ | ❌ |
| **Save / export / change session ID** | ✅ | ❌ | ❌ |
| **Grant / revoke temp owner** | ✅ | ❌ | ❌ |
| Close session | ✅ | ✅ *only if owner offline* | ❌ |

Rules that are easy to get wrong:

- **One** temp owner at a time (`session.tempOwnerId?: string`).
- Ownership is **never transferred** — the main owner stays `ownerId`. When the owner disconnects with a temp owner present, broadcast `ownership:transferred` and the session survives. The owner **reclaims automatically** on reconnect (`ownership:reclaimed`).
- Owner disconnects with **no** temp owner → session closes immediately, even if users remain.
- **No grace period.** Disconnect = removal, instantly. Reconnection is the client's job.
- File-op permission is `owner || tempOwner`. Storage/blob access is **owner only** — temp owners can edit live files but have no storage rights. This asymmetry is intentional.

---

## 5. WebSocket protocol

Route: `GET /api/websocket`, envelope `{ type, payload, timestamp? }`. JWT validated via `getServerSession`; no session → `401`.

**Client → server:** `join`, `leave`, `session:close`, `session:save`, `session:id-change`, `diff`, `cursor`, `status`, `file:create`, `file:delete`, `file:rename`, `chat`, `ownership:grant`, `ownership:revoke`, `send:zip`.

**Server → client:** `session:state`, `session:closed`, `session:saved`, `session:id-changed`, `diff`, `cursor`, `status`, `file:created`, `file:deleted`, `file:renamed`, `chat`, `ownership:granted`, `ownership:promoted`, `ownership:revoked`, `ownership:demoted`, `ownership:transferred`, `ownership:reclaimed`, `user:joined`, `user:left`, `user:status`, `user:cursor`, `user:file`, `request:zip`, `request:save`, `receive:zip`, `error`.

Broadcast semantics — this distinction matters:

- `diff` / `cursor` / `status` → **exclude the sender** (they already have it locally).
- `file:*` / `session:*` → **include everyone including the sender**.

Rate limiting is checked **before routing**, on every message. Server state is five maps: `sessions`, `connections`, `sessionMap`, `rateLimits`, `chatCooldowns`.

Add a Zod schema to `lib/websocket/validation.ts` for every new inbound event (all require `sessionId: z.string().uuid()`). There is currently **no schema for `send:zip`** — if you touch that path, add one.

---

## 6. Data flow you must not break

**Joining** — the server has no files, so it borrows them:

```
new client → join
server      → request:zip { targetUserId } to owner (or temp owner) client
owner client→ builds ZIP from its own state → send:zip { targetUserId, zip: base64 }
server      → receive:zip { zip } to new client
new client  → Buffer.from(zip,'base64') → extractZip → load into yjs
```

**Saving** — client owns ZIP creation, server owns persistence:

```
owner client → createZip() → reject if > 50MB
             → POST /api/sessions/:id/save  { zip: base64 }
server       → decode → re-check 50MB → storageService.upload → DB write → broadcast session:saved
```

The 50MB check is intentionally enforced at **three** layers (client, route, storage service). Keep all three.

**Collaboration** — every file is a `Y.Text` at key `` `file:${filePath}` `` in one `Y.Doc` per session. The server never sees CRDT internals; it relays `diff` payloads. Same-line conflicts resolve by yjs causal ordering automatically. Same-file simultaneous create → **first one wins, silently**.

---

## 7. File handling rules

- **Text only.** Reject/skip any entry whose content contains `\0`. Silent skip with a warning, not an error.
- **Import** requires a `.zip` extension; max 50MB; empty archive is an error; warns on `.env` / `.git` / `node_modules` entries but does not block.
- **Export** must error when the tree is empty; check size *after* generating.
- Paths must be **relative** and free of `..`, `/`, `\`. Reject, don't silently sanitize.
- Rename = create-new + delete-old, then broadcast `file:renamed { oldPath, newPath }`.
- Client-side writes are **dual-write**: local store first, then yjs, guarded by `if (!canEdit) return`.

See §11 item 5 — path validation is currently specified but not wired into the import path. Fix it when you write that code.

---

## 8. Frontend state ownership

One store per domain. No overlap, no duplication.

| Store | Owns |
| --- | --- |
| `sessionStore` | sessionId, name, ownerId, tempOwnerId, isSaved, users[], isOwner, isTempOwner |
| `fileStore` | files, openFiles[], activeFile, `fileContents: Map<string,string>`, isDirty |
| `editorStore` | cursors, selections, userStatuses (all `Map<userId, …>`) |
| `chatStore` | messages[], isMuted |
| `uiStore` | sidebarWidth, isSidebarOpen, activeSidebarTab, loading flags, notifications |

Hooks (`useWebSocket`, `useCollaboration`, `useFileSystem`, `useSession`, `useChat`, `usePresence`) are **orchestration only** — they own no state; they read stores and wire events.

**yjs is the source of truth for text.** `fileStore.fileContents` is a render mirror, refreshed from `text.observe(...)`. Components select from stores; `useState` is only for ephemeral UI (expanded folders, open context menu, rename input).

Debounce: cursor **100ms**, status **500ms**, file content **300ms**. Diff batching: 10 per 100ms. Reconnect delay: flat **3000ms**.

---

## 9. Routes & API

Route groups `(auth)` / `(dashboard)` do **not** appear in URLs.

```
/                      landing — redirects to /sessions if authed
/login  /register      (auth)
/sessions              saved sessions list — post-login target
/session/new           create
/session/join          join by UUID
/session/[id]          the IDE
```

REST (all non-auth require a NextAuth JWT):

```
POST   /api/auth/register
GET    /api/sessions                     list saved
POST   /api/sessions                     create → 403 at 3 saved
GET    /api/sessions/[id]                → { session, zip: base64 }
DELETE /api/sessions/[id]                → 409 if session is active
POST   /api/sessions/[id]/save           → 403 at 3 saved, 413 over 50MB
GET    /api/sessions/check/[id]          → { exists, isActive, userCount, … }
GET    /api/users/me
```

Error envelope: `{ error: string, code?: string, details?: object }`. Use the helpers in `lib/api-handler.ts` (`Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `RateLimit`, `Validation`) rather than raw `Response.json`. Rate-limited responses set `X-RateLimit-Limit` / `-Remaining` / `-Reset`.

Middleware public paths: `/login`, `/register`, `/api/auth`, `/_next`, `/favicon.ico`. Everything else redirects to `/login`.

---

## 10. Conventions

- **Imports:** absolute `@/…` always. Import order: external → `@/` internal → relative → types. Group from `index.ts` barrels when importing 2+ items from a directory.
- **Naming:** `camelCase` vars/functions, `PascalCase` components/interfaces/types, `UPPER_SNAKE_CASE` constants, `PascalCase.tsx` components, `useXxx.ts` hooks, `xxxStore.ts` stores.
- **Types:** `interface` for objects, `type` for unions. **No `any`** — ESLint treats it as an error. Use `unknown` + type guards.
- **Exports:** named for multiples; default only for a page's main component.
- **State updates:** always immutable (`set(prev => …)`). Never mutate a store directly; call its action.
- **Styling:** Tailwind classes only. No inline `style` props. No magic numbers — pull limits into `lib/constants.ts`.
- **Async:** `await`, never nested `.then()`.
- **Errors:** typed `ApiError` subclasses; messages must not leak internals. No sensitive data in logs.
- **A11y:** 4.5:1 contrast, keyboard reachable, ARIA labels on interactive elements, visible focus.
- **Commits:** `<type>(<scope>): <subject>` — `feat|fix|docs|style|refactor|test|chore`.

---

## 11. Commands

```bash
npm run dev                    # dev server
npm run build && npm start
npm run lint                   # ESLint (no-explicit-any is an error)

npm run db:generate            # generate migration
npm run db:push                # apply to dev DB
npm run db:migrate             # apply via runner
npm run db:studio              # Drizzle Studio
npm run db:reset               # drop + recreate (dev only)
npm run db:seed

npm test                       # Jest unit (jsdom)
npm run test:integration       # Jest node env — needs TEST_DATABASE_URL
npm run test:e2e               # Playwright (chromium/firefox/webkit)

npm run format                 # Prettier — semi: false, singleQuote, printWidth 100, arrowParens avoid
```

Coverage threshold **70%** global. Env: `.env.local` from `.env.example`. Required: `DATABASE_URL`, `NEXTAUTH_SECRET` (32+ chars), `NEXTAUTH_URL`, `BLOB_READ_WRITE_TOKEN`. Optional OAuth: `GITHUB_ID`/`GITHUB_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. `NEXT_PUBLIC_WS_URL` (`ws://` local, `wss://` prod).

Migration rules: every file exports **both** `up(db)` and `down(db)`; wrap multi-statement work in a transaction; always `IF NOT EXISTS` / `IF EXISTS`; never add `NOT NULL` without a `DEFAULT`; use `CREATE INDEX CONCURRENTLY` on large tables.

Password policy (`lib/auth/password.ts`) — 8–100 chars, ≥1 uppercase, ≥1 lowercase, ≥1 digit. No special-char rule. Email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

---

## 12. Before you finish

- [ ] `npm run lint` and `npm run build` clean
- [ ] Tests added for any non-trivial branch, loop, or permission check
- [ ] New WS event has a Zod schema **and** a permission entry
- [ ] New limit is in `lib/constants.ts` and enforced server-side, not just hidden in the UI
- [ ] No `any`, no inline styles, no magic numbers
- [ ] No secrets, tokens, or PII in logs or client storage
- [ ] Role checks go through `checkPermission`, not ad-hoc `isOwner` logic

---

## 13. Doc contradictions (resolved — follow this)

The `docs/` tree has known defects. Resolve them as follows and do not "fix" code back toward the docs.

1. **File-op event names.** Use `file:create` / `file:delete` / `file:rename` inbound and `file:created` / `file:deleted` / `file:renamed` outbound (WS events doc). The collab doc's `sendDiff({type:'file:created'})` is stale.
2. **`fileStore.files` shape.** `FileNode[]` with `{ path, name, content, type: 'file'|'folder', children?, extension?, size? }` — not the bare `FileTree` shown in the frontend doc.
3. **`/dashboard` does not exist.** Post-login target is `/sessions`. Fix the auth/register pages.
4. **Import path validation is specified but unwired.** `importZipFile` never calls `validateFilePath`/`sanitizeFilePath`, and `sanitizeFilePath` mutates instead of rejecting. Wire in the validators that **reject** — `..`, leading `/`, embedded separators.
5. **`moveFile` has no permission case.** `checkFilePermission` covers `create|delete|rename` only. Add `'move'` when you implement move, or drop the client method.
6. **`toJoinSession` is missing** from the `useNavigate` helper despite `joinSession: '/session/join'` existing. Add it.
7. **Manual vs automatic diffs.** The collab doc is authoritative: yjs syncs automatically; don't hand-generate diffs.
8. **Storage vs live-file permissions** differ by design (owner-only vs owner-or-temp-owner). Don't "unify" them.
9. Some `docs/` files have **unterminated code fences and duplicated whole-file appendices** (`04-file-management.md`, `03-collaboration.md`, `06-storage.md`, `02-frontend.md`). First occurrence wins; the rest is noise.
