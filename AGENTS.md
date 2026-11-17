# AGENTS.md

Operating manual for coding agents working on **GridCore**. This file is the **single source of truth / master prompt** for Builder and Reviewer.

> **Repo state (audited 2026):** GridCore is no longer "specification only". The repository contains a substantial Next.js 14 + TypeScript implementation (app routes, components, hooks, stores, lib modules, tests, scripts, config) alongside the `docs/` specification tree. Implementation and docs have drifted in places; **when code, docs, and this file disagree, this file wins** unless an item below explicitly marks a decision as provisional/open.

---

## 0. Mission and boundaries

### 0.1 What GridCore is

Real-time multiplayer web IDE. Users share a codebase and edit it together (pair programming, teaching, interviews).

### 0.2 The one architectural idea that governs everything else

> **Clients hold the state. The server is a message broker with a role-checker.**
> The server never stores file contents. It authenticates, checks permission, and broadcasts.

If a change makes the server remember file content, it is wrong.

### 0.3 Agent boundaries

- **Researcher (this document's author role):** deep research, audit, planning, explanations, and maintenance of `AGENTS.md` and `README.md` only. No application code changes.
- **Builder:** implements the fixes/features described in this plan, following this file exactly. Builder may modify application/config/test files as needed.
- **Reviewer:** verifies implementation against this file (contracts, permissions, protocol, limits, tests, quality gates).

**Implementation rule for Builder:** do not "fix" behavior back toward stale docs. Use this file as canonical. If a doc is wrong, prefer code+spec alignment defined here and record doc drift in PR/commit notes if docs cannot be edited in scope.

---

## 1. Current repository state (audit snapshot)

### 1.1 Present

- **App/framework:** Next.js App Router app in `app/` with auth/dashboard route groups, session pages, landing page, and API routes.
- **Config/tooling:** `package.json`, `tsconfig.json`, `next.config.js`, `.eslintrc.json`, `tailwind.config.ts`, `postcss.config.js`, `jest.config.mjs`, `jest.config.integration.mjs`, `jest.setup.ts`, `playwright.config.ts`, `drizzle.config.ts`, `.env.example`.
- **Core implementation:** `lib/` (auth, db, websocket, collaboration/yjs, file-system, storage, services, routes, env, errors, rate-limit), `stores/`, `hooks/`, `components/`, `types/`, `middleware.ts`.
- **Tests:** unit tests in `__tests__/unit` (stores, permissions, file-system, collaboration), integration test in `__tests__/integration/websocket.test.ts`, test setup/helpers in `__tests__/setup`.
- **Docs/spec:** `docs/` contains 34 markdown files across project overview, architecture, features, development, API, deployment, UI, and testing.

### 1.2 Notable drift / stale artifacts observed

- This file previously claimed "specification only / no package.json / no source" — **false now**.
- `README.md` contains encoding artifacts and some inaccurate/stale claims (e.g. specific test counts not matching visible test files; some route/behavior descriptions are optimistic vs current implementation). README must be kept accurate.
- Some `docs/` files have known formatting defects and spec/code drift (event payload details, examples, and legacy assumptions). Docs may not be fully authoritative; this file resolves canonical behavior for implementation.
- `GET /api/sessions/[id]/export` is referenced by client code (`hooks/useSession.ts`) but no route exists in `app/api/sessions/[id]/export`.
- E2E infrastructure/config exists, but no e2e spec files were found under `__tests__` during audit; verify actual Playwright test locations and coverage.

---

## 2. Stack and fixed technical choices

| Layer        | Choice (fixed)                                                           |
| ------------ | ------------------------------------------------------------------------ |
| Framework    | Next.js **14**, App Router                                               |
| Language     | TypeScript, `strict: true`                                               |
| UI           | React 18, Tailwind 3, **shadcn/ui**, lucide-react                        |
| Editor       | `@monaco-editor/react` (lazy-loaded, `ssr: false`)                       |
| Realtime     | `yjs` 13 (CRDT) + `ws` 8 over WebSocket route                            |
| Auth         | NextAuth 4 — credentials (bcrypt) + optional GitHub + Google, JWT 24h    |
| DB           | PostgreSQL + Drizzle ORM 0.29 (`@vercel/postgres` driver pattern)        |
| Storage      | Vercel Blob, private, ZIP payloads/base64 in JSON bodies where specified |
| Client state | Zustand 4                                                                |
| Validation   | Zod at trust boundaries (WS payloads, API bodies, env)                   |
| Tests        | Jest 29 (unit jsdom / integration node) + Playwright (e2e)               |
| Host target  | Vercel-compatible deployment                                             |

Do not substitute core stack choices without an explicit plan update in this file.

---

## 3. Hard limits and invariants (non-negotiable)

```
MAX_USERS_PER_SESSION       = 20
MAX_SAVED_SESSIONS_PER_USER = 3
MAX_ZIP_SIZE                = 50 * 1024 * 1024   (50MB)
MAX_SINGLE_FILE_SIZE        = 10 * 1024 * 1024   (10MB)
MAX_FILE_NAME_LENGTH        = 255
CHAT_MAX_MESSAGE_LENGTH     = 200
CHAT_COOLDOWN               = 10 * 1000          (10s)
RATE_LIMIT                  = { windowMs: 60_000, maxRequests: 30 }
MAX_DOCUMENT_SIZE (yjs)     = 10 * 1024 * 1024   (10MB, warn/guard behavior as defined)
WS message size             = 1 * 1024 * 1024    (1MB)
RECONNECT_DELAY             = 3000ms (flat)
```

Other invariants:

- Session IDs are **UUID v4** and server-generated for authority-sensitive flows (e.g. session ID change).
- PostgreSQL over SSL in production environments.
- WSS in production.
- bcrypt cost **10**.
- JWT max age **24h**.
- Dark theme only.
- **One tab per user** enforced via LocalStorage heartbeat/coordination and server-side connection/session checks; blocked state/message: `"You already have GridCore open"`.

All limits must live in `lib/constants.ts` (or be derived from it) and be enforced server-side where applicable, not only hidden in UI.

---

## 4. Permission model (single source of truth)

Three roles. `checkPermission(sessionId, userId, permission)` in `lib/websocket/permissions.ts` is the canonical authorization function. **Server and client must route through it / mirror it exactly.** Never hand-roll ad-hoc `isOwner` checks for permission decisions.

| Action                                                            | Main Owner |         Temp Owner         | Regular User |
| ----------------------------------------------------------------- | :--------: | :------------------------: | :----------: |
| Create active session (product/API flow)                          |     ✅     |             ❌             |      ❌      |
| Join / leave session                                              |     ✅     |             ✅             |      ✅      |
| View files, presence, chat                                        |     ✅     |             ✅             |      ✅      |
| Edit file contents (CRDT text edits)                              |     ✅     |             ✅             |      ✅      |
| Create / delete / rename files (structural ops)                   |     ✅     |             ✅             |      ❌      |
| **Save / export / change session ID** (storage/session-admin ops) |     ✅     |             ❌             |      ❌      |
| **Grant / revoke temp owner**                                     |     ✅     |             ❌             |      ❌      |
| Close session                                                     |     ✅     | ✅ _only if owner offline_ |      ❌      |

### 4.1 Rules that are easy to get wrong

- **One temp owner at a time** (`session.tempOwnerId?: string`). Replacing temp owner must be explicit: revoke/demote old temp owner and notify clients before/with promoting new one (no silent overwrite).
- **Ownership is never transferred.** Main owner remains `ownerId`. When owner disconnects and a temp owner is present, broadcast `ownership:transferred` and session survives under temp-owner stewardship. When owner reconnects/reclaims, broadcast `ownership:reclaimed` and restore owner control semantics.
- Owner disconnects with **no temp owner** → session closes immediately, even if other users remain.
- **No grace period.** Disconnect/removal is immediate at protocol/state level; reconnection is client responsibility.
- **File-op permission vs storage permission differ by design:** owner or temp owner may perform live structural file ops; **only main owner** may save/export/change session ID/access persisted blob state. Do not "unify" these.

### 4.2 Client permission mirrors

- UI permission hooks/stores may gate affordances but must not be treated as security. Server remains authoritative.
- Client code must distinguish:
  - **content edit capability** (all session members), vs
  - **structural file operations** (owner/temp owner), vs
  - **session/storage admin operations** (owner only).
    Current implementation conflates these in places; fixing this is mandatory.

---

## 5. WebSocket protocol (canonical contract)

### 5.1 Transport and envelope

- Route: `GET /api/websocket` (upgrade endpoint). JWT validated via `getServerSession`; unauthenticated → `401`.
- Envelope: `{ type: string, payload: unknown, timestamp?: number }`.
- Validate every inbound payload with Zod before routing (`lib/websocket/validation.ts`).
- Enforce rate limiting **before routing/handling** on every inbound message.
- Enforce max inbound WS message size (`1MB`) at the transport/adapter boundary where possible and reject oversized frames/messages safely.

### 5.2 Event sets

**Client → Server (canonical):** `join`, `leave`, `session:close`, `session:save`, `session:id-change`, `diff`, `cursor`, `status`, `file:create`, `file:delete`, `file:rename`, `chat`, `ownership:grant`, `ownership:revoke`, `send:zip`.

**Server → Client (canonical):** `session:state`, `session:closed`, `session:saved`, `session:id-changed`, `diff`, `cursor`, `status`, `file:created`, `file:deleted`, `file:renamed`, `chat`, `ownership:granted`, `ownership:promoted`, `ownership:revoked`, `ownership:demoted`, `ownership:transferred`, `ownership:reclaimed`, `user:joined`, `user:left`, `user:status`, `user:cursor`, `user:file`, `request:zip`, `request:save`, `receive:zip`, `error`.

> **Contract note:** `send:zip` is a relay payload and currently includes `targetUserId`, `zip`, optional `state`; it may not carry `sessionId` because server infers sender session membership. This is an allowed exception to "all events require sessionId" but must be strictly validated and authorized (same-session, authorized provider, expected target/request flow).

### 5.3 Broadcast semantics

- `diff`, `cursor`, `status` → **exclude sender** (sender already applied locally).
- `file:*`, `session:*`, `chat`, ownership broadcasts, user presence broadcasts → include/exclude per event semantics as needed for consistent state; current canonical intent:
  - `chat`: include sender (single ordered log across clients)
  - structural file ops (`file:created/deleted/renamed`) and session lifecycle events: broadcast to room so all clients converge (including sender is acceptable if clients are idempotent; prefer explicit, documented behavior and idempotent handlers)
  - `user:joined/user:left/...`: exclude sender where redundant, but ensure joiner receives full room state/roster.

### 5.4 Server state

In-memory maps (current implementation shape): `sessions`, `connections`, `sessionMap`, `rateLimits` (if used), `chatCooldowns`. Avoid duplicate/unused rate-limit stores; keep one authoritative rate-limit mechanism.

### 5.5 Required server behaviors (audit-driven clarifications)

- **Join:** verify session exists/active, capacity, membership constraints, and provider availability. Return `session:state` with enough info for client hydration (session metadata and current users/roles/presence as applicable). Send `request:zip` to authorized provider (owner if online else temp owner). Notify room of join and ensure joiner learns existing participants.
- **Owner reclaim:** if owner reconnects to a session under temp-owner stewardship, restore owner-active semantics and emit `ownership:reclaimed` (and demotion/promotion messages as needed) consistently.
- **Disconnect/leave:** remove presence immediately. Broadcast `user:left` for non-owner departures/disconnects as appropriate. If temp owner disconnects/leaves, clear temp ownership and notify room/affected user consistently. If owner leaves/disconnects, transfer to temp owner if present else close session.
- **Temp owner grant:** only owner; target must be in session; enforce single temp owner (revoke/demote previous if replacing, per explicit flow). Notify room and target.
- **send:zip relay:** only an authorized provider for that session may send; target must be the intended joiner in same session (and ideally tied to an outstanding request). Enforce size/format constraints and never relay arbitrary payloads across sessions.
- **Path/content validation for file ops:** server must reject unsafe paths (`..`, absolute paths, backslashes, drive letters) and invalid names/lengths for structural file operations, not rely solely on client checks.
- **Error handling:** send typed/structured `error` events with stable codes; never leak internals.

---

## 6. Data flows that must not break

### 6.1 Joining (server borrows state from a client)

```
new client  → join
server      → request:zip { targetUserId } to owner (or temp owner) client
provider    → builds ZIP from local/yjs state (+ yjs update/state payload if used)
provider    → send:zip { targetUserId, zip: base64, state?: base64 }
server      → receive:zip { zip, state? } to new client
new client  → applies CRDT/state and/or extracted files into yjs + store consistently
```

**CRDT correctness requirement:** incremental yjs updates must merge against compatible shared history. Prefer seeding joiners with encoded yjs state/update as implemented; any fallback path must preserve convergence semantics.

### 6.2 Saving (client builds ZIP, server persists)

```
owner client → createZip() → reject if > 50MB
             → POST /api/sessions/:id/save { zip: base64 }
server       → authz (owner only) → decode → re-check 50MB → storage upload → DB upsert/link → mark/broadcast session:saved
```

The 50MB check is intentionally enforced at **three layers** (client, API/service, storage service). Keep all three.

### 6.3 Collaboration

- Every file is a `Y.Text` at key `` `file:${filePath}` `` in one `Y.Doc` per session.
- **yjs is the source of truth for text.** Server relays opaque CRDT updates/diff payloads; it does not author or interpret file text merges.
- Same-line conflicts resolve by yjs causal ordering.
- Same-file simultaneous create → first write wins, silently (define/idempotently enforce in yjs/store behavior).

### 6.4 Structural file sync (must converge across clients)

A known audit gap: structural changes (`file:create/delete/rename`, imports, folder ops) must converge in **both** yjs state representation and the UI file tree/store on every client.

- Do not rely on text observers alone if they cannot create/remove/rename tree nodes.
- Handle `file:created/deleted/renamed` (and any folder semantics) idempotently on clients, or derive/reconcile tree state from authoritative yjs/session snapshot events.
- Avoid N-per-file broadcast storms on large imports where possible; if used, ensure idempotency, ordering, and rate-limit safety.

---

## 7. File handling rules

- **Text only.** Reject/skip any entry whose content contains `\0` (binary). Silent skip with warning, not fatal error (unless archive becomes empty/invalid per rules).
- **Import:** `.zip` required; max 50MB; empty archive is an error; warn on `.env` / `.git` / `node_modules` entries but do not block. Extraction/import must reject unsafe paths.
- **Export:** error when there are no files; check size after generating.
- **Paths:** relative only; reject `..`, leading `/` or `\`, embedded backslashes, drive letters/UNC-like prefixes. **Reject, never sanitize/mutate into a different path.** Enforce in import/extraction, client actions, and server-side WS/API handlers for structural ops.
- **Names/lengths:** enforce `MAX_FILE_NAME_LENGTH` and related constraints consistently.
- **Rename:** conceptually create-new + delete-old in collaborative state; broadcast `file:renamed { oldPath, newPath }`; update all affected paths for folder renames in both tree and yjs key space.
- **Client-side writes:** dual-write local store and yjs in the correct order for responsiveness/convergence, but **guard by correct permission** (`content edit` vs `structural op` vs `owner-only export/save`). Never allow unauthorized local mutation that diverges from server authority.

**Known implementation issues to fix:** path/permission enforcement gaps, folder rename not propagated through yjs file keys, import/export permission and sync behavior, remote structural events not applied to file tree.

---

## 8. Frontend state ownership and hooks

### 8.1 Stores (one domain each, no overlap)

| Store          | Owns                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `sessionStore` | sessionId, name, ownerId, tempOwnerId, isSaved, users/roster, current user identity/derived role helpers |
| `fileStore`    | files tree (`FileNode[]`), openFiles[], activeFile, `fileContents` mirror, dirty flags                   |
| `editorStore`  | cursors, selections, user statuses/presence editing state (`Map<userId,...>`)                            |
| `chatStore`    | messages[], mute/cooldown-related UI state as needed                                                     |
| `uiStore`      | sidebar/layout state, active tabs, loading flags, notifications/toasts                                   |

### 8.2 Hooks

`useWebSocket`, `useCollaboration`, `useFileSystem`, `useSession`, `useChat`, `usePresence`, etc. are **orchestration only**: wire events, call stores/services, derive UI actions. Hooks must not become shadow state containers.

### 8.3 Rendering/source-of-truth rules

- `fileStore.fileContents` is a render mirror; yjs text is authoritative for file contents.
- Components select from stores; `useState` only for ephemeral local UI (expanded folders, open context menu, rename input, dialog-local form state).
- Hydration/sync must be deterministic: avoid races where yjs observers, websocket events, and one-time snapshot hydration fight each other.

### 8.4 Timing constants

- Cursor debounce **100ms**, status debounce **500ms**, file content debounce **300ms** (where applicable).
- Diff batching target 10 per 100ms (if implemented).
- Reconnect delay flat **3000ms**.

---

## 9. Routes, API, and middleware

### 9.1 App routes

Route groups `(auth)` / `(dashboard)` do **not** appear in URLs.

```
/                      landing — redirects to /sessions if authed
/login  /register      (auth)
/sessions              saved sessions list
/session/new           create session flow
/session/join          join by UUID flow
/session/[id]          IDE workspace
```

### 9.2 REST API (canonical)

All non-auth endpoints require authenticated NextAuth session unless explicitly documented otherwise.

```
POST   /api/auth/register
GET    /api/sessions                     list saved sessions for user
POST   /api/sessions                     create active session → 403 at saved-session limit (per policy)
GET    /api/sessions/[id]                load saved session → { session, zip: base64 }
DELETE /api/sessions/[id]                delete saved session → 409 if active
POST   /api/sessions/[id]/save           save session (owner only) → 403/413 as applicable
GET    /api/sessions/check/[id]          session availability/status (used by join flow)
GET    /api/users/me
```

**Known gap:** no `GET /api/sessions/[id]/export` route currently exists; remove/replace broken client references or implement route only if it fits owner-only storage/export semantics (prefer client-side zip export from live/yjs state for active sessions unless a saved-export endpoint is explicitly required).

### 9.3 API behavior contracts

- Error envelope: `{ error: string, code?: string, details?: object }` (or equivalent typed fields). Use helpers/wrappers in `lib/api-handler.ts` and typed `ApiError`s (`lib/errors.ts`) consistently.
- Do not throw typed errors from route handlers without mapping to HTTP responses.
- Rate-limited responses should include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` when feasible (accurate values preferred).
- Middleware public paths must include auth and Next.js internals needed for login/register; everything else protected per policy.

---

## 10. Security, validation, and reliability requirements

- Validate all trust-boundary inputs with Zod (WS payloads, API bodies, env).
- Enforce authz server-side for every privileged action (session admin, file ops, save/export, relay flows).
- Prevent path traversal and unsafe file/path inputs by rejection.
- Enforce message and payload size limits (chat, WS frames/messages, zip/file sizes, yjs/document guards where applicable).
- Never store or broadcast secrets/tokens/PII in logs or client-visible errors.
- Multi-tab/single-session-per-user behavior must be robust (no silent connection hijacking between tabs for same user).
- Blob storage operations must use correct Vercel Blob APIs/URLs for upload/download/delete/exists; saved-session load is broken if download path handling is wrong.

---

## 11. Part-by-part audit: findings and required fixes

Severity guide: **Critical** = broken core flow/security/data integrity; **High** = major spec violation or likely user-visible failure; **Medium** = correctness/UX/maintainability issue; **Low** = cleanup/docs/minor drift.

### 11.1 Documentation & repo meta

| ID    | Severity | Finding                                                                                            | Evidence / notes                                               | Required fix                                                                                                          |
| ----- | -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| DOC-1 | High     | `AGENTS.md` stale (claimed spec-only/no source)                                                    | Previous content vs actual repo                                | Keep this file current as master plan/contract (this rewrite).                                                        |
| DOC-2 | Medium   | `README.md` has encoding artifacts and stale/inaccurate claims (e.g. test counts/behavior details) | README text and `__tests__` contents                           | Rewrite README for accuracy, clarity, and current status; link to AGENTS for audit/plan.                              |
| DOC-3 | Medium   | `docs/` contains formatting defects and spec/code drift                                            | AGENTS prior note; spot checks in WS/ownership docs            | Treat this file as canonical; record drift. If docs editing becomes in-scope later, align docs to canonical contract. |
| DOC-4 | Medium   | E2E tooling configured but e2e test coverage/location unclear                                      | `playwright.config.ts` exists; no obvious specs in `__tests__` | Verify/add e2e tests or correct scripts/docs to reflect reality.                                                      |

### 11.2 Authentication, middleware, env

| ID     | Severity | Finding                                                                                       | Evidence / notes                                                                       | Required fix                                                                                                                            |
| ------ | -------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-1 | High     | `app/api/auth/register/route.ts` throws typed errors without `ApiError`→HTTP response mapping | Route not wrapped in `buildHandler`; throws `ValidationError`/`ConflictError`          | Wrap with consistent error handling or convert thrown `ApiError`/Zod errors to proper `NextResponse` with correct status/code envelope. |
| AUTH-2 | Medium   | Session-check endpoint behavior/comment drift (`withoutRateLimit` still auth-protected)       | `app/api/sessions/check/[id]/route.ts` comment says public read; wrapper enforces auth | Align comment/contract and client flow; ensure join UX works under intended auth model.                                                 |
| AUTH-3 | Medium   | OAuth account-linking by email is implicit                                                    | `lib/auth/nextauth.ts` upsert logic                                                    | Document risk/behavior; consider verified-email safeguards if supported by providers/product decision.                                  |
| AUTH-4 | Low      | Env validation utility exists but runtime enforcement points should be explicit               | `lib/env.ts`, `scripts/validate-env.ts`                                                | Ensure startup/scripts/CI paths validate env where appropriate; fail fast with clear errors.                                            |

### 11.3 WebSocket server, protocol, authorization

| ID    | Severity | Finding                                                                                                                                                                       | Evidence / notes                                                                           | Required fix                                                                                                                                           |
| ----- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WS-1  | Critical | Owner reconnect/reclaim flow incomplete; `ownership:reclaimed` never emitted and temp-owner stewardship not restored correctly on owner rejoin                                | `lib/websocket/server.ts` join/leave/disconnect logic                                      | Implement canonical reclaim semantics (state transitions + events) and tests for owner-offline/temp-owner takeover/owner-return.                       |
| WS-2  | Critical | `handleOwnershipGrant` can replace an existing temp owner without revoking/demoting the previous one                                                                          | `handleOwnershipGrant` sets `tempOwnerId` after only checking if target already temp owner | Enforce single-temp-owner transitions with explicit revoke/demote of previous holder (or reject) and consistent broadcasts.                            |
| WS-3  | Critical | `send:zip` relay is under-authorized/under-validated                                                                                                                          | `handleSendZip` checks sender in session and target connected only                         | Require authorized provider, same-session target, expected/requested transfer context if feasible, payload/size validation, and robust error handling. |
| WS-4  | High     | `handleDisconnect` does not broadcast `user:left` for non-owner disconnects; temp-owner disconnect clears temp ownership without consistent revocation/demotion notifications | `handleDisconnect` implementation                                                          | Emit correct presence/ownership events on disconnect paths; keep room state consistent.                                                                |
| WS-5  | High     | WS route upgrade/adapter assumptions are platform-specific and no explicit inbound message size enforcement                                                                   | `app/api/websocket/route.ts`                                                               | Harden adapter for supported runtime(s), enforce 1MB inbound limit, and document runtime constraints/fallback behavior.                                |
| WS-6  | High     | Server-side validation for structural file op paths/names is missing or incomplete                                                                                            | WS schemas validate basic strings; handlers don’t apply path safety checks                 | Reuse `lib/file-system/security`/validation rules server-side for `file:create/delete/rename` (and any future move). Reject unsafe inputs.             |
| WS-7  | High     | `session:state`/join flow may not provide sufficient roster/user metadata for clients                                                                                         | `handleJoin` sends `users: []`; `user:joined` payload minimal                              | Define and implement roster hydration contract so all clients can render presence/roles/names/colors consistently.                                     |
| WS-8  | Medium   | Duplicate/unused rate-limit state (`state.rateLimits` vs `lib/rate-limit.ts`)                                                                                                 | `state.ts`, server cleanup, rate-limit module                                              | Consolidate to one authoritative limiter/store and prune correctly.                                                                                    |
| WS-9  | Medium   | Multi-tab handling can overwrite same-user connection on server (`connections.set(userId, socket)`)                                                                           | `handleConnect` and no explicit multi-tab rejection                                        | Detect and reject/coordinate duplicate active connections/tabs per user with explicit error semantics; align with client tab guard.                    |
| WS-10 | Medium   | `send:zip` schema/contract exception not fully documented/enforced (no sessionId, no explicit max length)                                                                     | `validation.ts`, types, AGENTS prior text                                                  | Clarify canonical schema/limits and enforce them; ensure relay cannot carry unbounded payloads.                                                        |

### 11.4 Collaboration, file sync, yjs/store convergence

| ID     | Severity | Finding                                                                                                                                     | Evidence / notes                                                                  | Required fix                                                                                                                                                         |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SYNC-1 | Critical | Remote structural file events are not applied on clients (`file:created/deleted/renamed` handlers missing)                                  | search shows server/types emit them; no client handlers in hooks/components       | Implement idempotent client handling for structural events and reconcile with yjs/store/tree.                                                                        |
| SYNC-2 | Critical | `fileStore.updateFileContent` cannot insert missing tree nodes; yjs-observer-driven updates may not create visible files                    | `stores/fileStore.ts` + `lib/file-system/helpers.ts` + `observeFile` usage        | Make content sync/tree reconciliation robust (insert-on-missing when appropriate, or rebuild/derive affected branches from yjs snapshot).                            |
| SYNC-3 | High     | Import sync strategy is unsound (permission gating issues, per-file broadcast flood, sender/local divergence risk, remote convergence gaps) | `hooks/useFileSystem.ts` import path and WS handlers                              | Redesign import to enforce correct permissions, update yjs/store coherently, and propagate a convergent full-structure/state update to peers efficiently and safely. |
| SYNC-4 | High     | Folder rename/move semantics not reflected in yjs file key space                                                                            | `rename` in `useFileSystem` moves single path in yjs; store rebases children only | Implement folder-aware rename/move across all descendant yjs texts and broadcasts/state sync; add tests.                                                             |
| SYNC-5 | High     | Receive/hydration flow is fragile and may race (yjs state apply vs zip fallback vs one-time hydration)                                      | `WebSocketProvider` + `useCollaboration`                                          | Define deterministic join/hydration sequence and ensure file tree/store always reflects final yjs state.                                                             |
| SYNC-6 | Medium   | Empty folders are not representable/preserved in yjs snapshot/zip map model                                                                 | yjs keyed by file texts; snapshot/buildTree from file map                         | Decide and document behavior (supported via explicit metadata/placeholder or explicitly unsupported) and align UI/import/export accordingly.                         |

### 11.5 Permissions and client action gating

| ID     | Severity | Finding                                                                                                                                                 | Evidence / notes                                                                     | Required fix                                                                                                                                                              |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PERM-1 | Critical | `useFileSystem` gates structural operations and import/export using `usePermissions().canEdit` (true for all members), not structural/admin permissions | `hooks/useFileSystem.ts`, `hooks/usePermissions.ts`                                  | Split checks: content edits vs create/delete/rename/import (owner/temp owner) vs export/save/change-session-id (owner only). Prevent unauthorized local mutations/events. |
| PERM-2 | High     | Export UX/API paths inconsistent (`useSessionActions.exportSession` hits missing API route; controls use client-side export)                            | `hooks/useSession.ts`, `components/session/SessionControls.tsx`                      | Remove/fix broken export action path; standardize on canonical owner-only export flow and enforce permissions consistently.                                               |
| PERM-3 | Medium   | Temp-owner close-session UI affordance may not reflect "owner offline only" restriction                                                                 | `usePermissions.canCloseSession` returns canEditFiles; server enforces stricter rule | Align UI gating/messaging with server rule; surface server rejection clearly.                                                                                             |
| PERM-4 | Medium   | Save button/state handling inconsistent (`SessionControls` sends directly; `isSaving` lifecycle incomplete)                                             | `SessionControls.tsx`, `useSession.ts`, `useWebSocket.tsx`                           | Centralize save flow state transitions and success/failure/reset behavior.                                                                                                |

### 11.6 Storage, persistence, API/services

| ID      | Severity | Finding                                                                                                         | Evidence / notes                                                                                                       | Required fix                                                                                                                                       |
| ------- | -------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| STORE-1 | Critical | `lib/storage/blob.ts` download implementation likely broken (fetches path string, not blob URL/download result) | `upload` stores returned URL in DB but `download` does `fetch(this.getPath(...))` and `exists/head` use path semantics | Use Vercel Blob download APIs/URLs correctly; make `exists/download/delete` consistent and test against real blob semantics.                       |
| STORE-2 | High     | `POST /api/sessions` and saved-session limit semantics need precise alignment/confirmation                      | `createActiveSession` blocks creation when saved count >= 3                                                            | Confirm intended product rule (cannot create active session at limit vs cannot save beyond limit) and enforce consistently in API/service/UI/docs. |
| STORE-3 | Medium   | `checkSession` returns hardcoded `maxUsers: 20`                                                                 | `lib/services/session-service.ts`                                                                                      | Use `MAX_USERS_PER_SESSION` constant.                                                                                                              |
| STORE-4 | Medium   | Saved/active session edge cases on restart/multi-instance are only partially handled                            | in-memory session state vs DB/blob                                                                                     | Document and harden behavior within single-instance constraints; avoid misleading UI states.                                                       |

### 11.7 UI/UX and routing

| ID   | Severity | Finding                                                                                                         | Evidence / notes                            | Required fix                                                                                                             |
| ---- | -------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| UI-1 | High     | Session ID change updates state but not browser URL/route lifecycle                                             | `session:id-changed` handler in WS provider | Navigate/replace URL to new session route and reinitialize session-scoped providers/hooks safely; update copy/invite UX. |
| UI-2 | Medium   | Join/session roster and identity display may be incomplete due to missing initial roster/user metadata          | WS join/state handling                      | Ensure UI can render current participants, roles, and names/colors reliably.                                             |
| UI-3 | Medium   | Owner leave/close UX copy may not match actual server behavior (transfer vs close, save-before-leave semantics) | `SessionControls` dialogs and actions       | Align labels/dialogs with protocol semantics and implement explicit flows where needed.                                  |
| UI-4 | Low      | Some components/hooks may not yet meet lint/a11y/typing conventions                                             | ESLint strict rules configured              | Run lint/typecheck and remediate systematically.                                                                         |

### 11.8 Tests, quality gates, and observability

| ID     | Severity | Finding                                                                                                | Evidence / notes                         | Required fix                                                                                                                                                                                       |
| ------ | -------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TEST-1 | High     | Coverage of critical protocol/permission/sync edge cases is likely insufficient relative to known bugs | limited visible test files vs complexity | Add/expand unit + integration tests for ownership reclaim, grant replacement, disconnect presence, send:zip auth, path validation, save/load blob flow, structural sync/import/export permissions. |
| TEST-2 | Medium   | No clearly located e2e specs despite Playwright config/scripts                                         | repo audit                               | Add smoke e2e for auth → create/join/edit/save/export basics, or update commands/docs.                                                                                                             |
| TEST-3 | Medium   | README/test-count claims not trustworthy                                                               | README vs repo                           | Keep README factual; prefer "how to run tests" over brittle counts unless generated.                                                                                                               |

---

## 12. Master fix plan for Builder (prioritized, dependency-ordered)

Execute in phases. Keep changes small, test-backed, and spec-aligned. After each phase, run relevant tests and update this file only if the plan/contract changes.

### Phase 0 — Baseline, reproducibility, and guardrails

**Goals:** establish a reliable baseline before behavioral changes.

- [ ] Verify/install dependencies in a clean environment; ensure `npm run lint`, `npm run typecheck` (if added/used), `npm run build`, and existing tests run (or document exact blockers).
- [ ] Audit `tsconfig`, ESLint, Jest, Playwright, Drizzle configs against this file and fix config drift.
- [ ] Add/confirm a single constants source for protocol/permission-related UI mirroring where appropriate (without duplicating authority).
- [ ] Create/refresh test helpers/fixtures for WS sessions, multi-user flows, and blob/storage mocking as needed.

**Acceptance:** baseline is reproducible; failing tests/issues are understood and categorized.

### Phase 1 — Critical correctness and security fixes (server/protocol/storage)

**Goals:** make core session lifecycle, authz, and persistence safe and correct.

- [ ] **WS-1 / ownership reclaim:** implement owner reconnect/reclaim path, emit `ownership:reclaimed`, and ensure temp-owner demotion/promotion semantics match §4/§5.
- [ ] **WS-2:** fix temp-owner grant replacement to revoke/demote previous temp owner (or reject) with correct events and state.
- [ ] **WS-4:** broadcast `user:left` and ownership/presence updates correctly on disconnect/leave/temp-owner loss; keep `sessionMap`, `sessions.users`, and `tempOwnerId` consistent.
- [ ] **WS-3 / WS-10:** harden `send:zip` validation/authz (authorized provider only, same-session target, request correlation if feasible, payload size checks) and document schema exception clearly.
- [ ] **WS-6:** enforce server-side path/name validation for file structural ops; reject unsafe inputs with clear error codes.
- [ ] **WS-5:** harden WS route/adapter and enforce inbound message size limit; clarify runtime support constraints.
- [ ] **STORE-1:** fix Vercel Blob download/exists/delete to use correct blob URL/API semantics; add tests for save/load roundtrip logic (mocked).
- [ ] **AUTH-1:** fix register route error mapping to return proper HTTP responses.
- [ ] **WS-8/WS-9:** consolidate rate-limit state and implement robust multi-tab/duplicate-connection handling per user.

**Acceptance:** permission/lifecycle protocol tests pass; unauthorized/invalid relay and file-op attempts are rejected; saved session load works with fixed blob access.

### Phase 2 — Client/server state convergence and collaboration integrity

**Goals:** ensure all clients converge on the same file tree and content.

- [ ] **SYNC-1/2:** implement client handling for `file:created/deleted/renamed` and make store/yjs observers capable of reflecting structural changes (not just text updates to existing nodes).
- [ ] **SYNC-5:** define deterministic join hydration (yjs state + roster/session state + file tree reconciliation); eliminate races/double-apply issues.
- [ ] **SYNC-3:** redesign import flow (owner/temp-owner only): update yjs/store once, propagate convergent state/operations safely, avoid per-file event storms where possible, and handle partial failures/warnings clearly.
- [ ] **SYNC-4:** support folder rename/move correctly across tree and yjs keys (or explicitly disable unsupported folder ops end-to-end with consistent UX/server validation).
- [ ] **WS-7 / UI-2:** provide/join with complete roster/user metadata and keep presence/role/name/color state consistent on join/leave/reclaim.
- [ ] **UI-1:** handle `session:id-changed` by updating route/URL and session-scoped client state safely.

**Acceptance:** multi-client scenarios (join mid-session, create/delete/rename, import, owner disconnect/reclaim) converge without missing files or stale presence.

### Phase 3 — Permission/UI alignment and API cleanup

**Goals:** make user-facing behavior match canonical permissions and contracts.

- [ ] **PERM-1:** refactor client permission checks/gating in hooks/components (`useFileSystem`, controls, dialogs) to separate content edit, structural file ops, and owner-only admin/storage ops.
- [ ] **PERM-2:** remove/fix broken export API usage; standardize export flow (and save flow) with correct permissions and loading/error states.
- [ ] **PERM-3/PERM-4:** align close/save/change-id UX with server rules and async outcomes; centralize state resets/notifications.
- [ ] **STORE-2/STORE-3:** resolve saved-session-limit policy ambiguities, use constants everywhere, and align API responses/messages.
- [ ] **AUTH-2/UI-3:** clean up endpoint comments/contracts and user-facing copy to match actual behavior.

**Acceptance:** UI never offers impossible actions silently; server rejections are graceful; save/export/import/join/leave flows are coherent.

### Phase 4 — Hardening, tests, docs polish, and release readiness

**Goals:** lock in quality and prevent regressions.

- [ ] Add/expand unit tests (permissions, path validation, store reducers/helpers, yjs/file-tree reconciliation, auth/password/utils).
- [ ] Add/expand integration tests (WS protocol flows, ownership transfer/reclaim, relay authz, disconnect handling, save/load service behavior).
- [ ] Add or repair e2e smoke flows (auth, create/join session, collaborative edit, structural file ops, save/export/import happy paths and key failures) if feasible in environment.
- [ ] Run `npm run lint`, `npm run build`, `npm test`, `npm run test:integration`, `npm run test:e2e` (as available) and fix failures.
- [ ] Update `README.md` to accurately describe setup, commands, architecture, limitations, and current status.
- [ ] Reconcile this file with final implementation decisions; keep known limitations explicit.

**Acceptance:** all quality gates in §13 pass or any unavoidable environment-specific exceptions are documented here.

---

## 13. Verification and quality gates (Builder/Reviewer checklist)

- [ ] `npm run lint` passes (no `any`, no lint violations introduced/left unaddressed).
- [ ] `npm run build` passes.
- [ ] `npm test` passes; `npm run test:integration` passes (with required test env/services); `npm run test:e2e` passes or documented environment constraint is recorded.
- [ ] Coverage meets or exceeds **70%** global where configured/applicable; critical branches (permissions, protocol, validation, persistence) are explicitly tested.
- [ ] Every inbound WS event has Zod validation and correct authorization checks.
- [ ] All hard limits are enforced server-side and sourced from constants.
- [ ] No secrets/tokens/PII in logs, errors, or client storage.
- [ ] No ad-hoc permission logic; `checkPermission`/canonical mirrors used consistently.
- [ ] Save/load/export/import/join/leave/owner-reclaim flows verified manually in a multi-client scenario.
- [ ] README and AGENTS reflect actual behavior.

---

## 14. Canonical decisions and known doc/spec drift (resolved for implementation)

1. **File-op event names:** inbound `file:create/delete/rename`, outbound `file:created/deleted/renamed`.
2. **File tree shape:** `FileNode[]` with `{ path, name, content?, type: 'file'|'folder', children?, extension?, size? }`.
3. **Post-login target:** `/sessions` (not `/dashboard`).
4. **Path handling:** reject unsafe paths (`..`, absolute/leading separators, backslashes, drive letters). Never sanitize into alternate paths.
5. **`move` operation:** either implement end-to-end with proper permission/schema/protocol/tree+yjs updates, or do not expose it. Partial support is not allowed.
6. **Navigation helper:** include `toJoinSession` if join route exists in route map/helpers.
7. **CRDT diffs:** yjs produces/applies updates; do not hand-author merge diffs. Server relays opaque payloads.
8. **Storage vs live file permissions:** owner-only storage/admin actions vs owner/temp-owner structural live edits — intentional asymmetry.
9. **Docs formatting/drift:** some `docs/` files have unterminated fences/duplications and outdated examples; treat as non-canonical where they conflict with this file.
10. **`send:zip` payload:** may omit `sessionId` and include `state`; must be strictly authorized/validated as relay traffic.
11. **Current implementation may be ahead of old docs in some areas and behind in others;** Builder must align implementation to this contract, not to stale prose.

---

## 15. Open decisions / risks to track during implementation

- **Saved-session limit semantics:** confirm whether active-session creation is blocked at 3 saved sessions (current behavior) or only saving is blocked. Canonicalize and enforce consistently.
- **Folder representation:** empty folders are not preserved by current file-map/yjs snapshot approach; decide to support explicitly (metadata) or declare unsupported and enforce in UI/import/export.
- **Runtime support for WS upgrades:** Next/Vercel/runtime environment may constrain `GET /api/websocket` upgrade behavior; ensure chosen deployment/runtime path is actually viable.
- **Multi-instance scaling:** in-memory WS/session state is single-instance only; restart drops active sessions. Redis/shared pubsub + sticky sessions would be required for horizontal scaling (future work, not implied by this plan).
- **E2E scope/environment:** Playwright tests may require browser/runtime dependencies not present in all CI/dev environments; document prerequisites and keep smoke coverage realistic.

Builder should resolve these explicitly in code/docs/PR notes and update this file if a canonical decision changes.
