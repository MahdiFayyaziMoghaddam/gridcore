# GridCore

A real-time multiplayer web IDE for the browser. Share a session ID and edit the same codebase together in real time.

> **Status:** Active implementation in progress. The repository contains a substantial Next.js 14 + TypeScript codebase, but a recent part-by-part audit identified critical correctness/security/sync issues that must be fixed before the system can be considered reliable. See [`AGENTS.md`](./AGENTS.md) for the canonical architecture contract, audit findings, and the prioritized fix plan.

---

## TL;DR

**Problem:** Pair programming, teaching, interviews, and quick collaborative edits are awkward when everyone needs local setup and file sharing.

**Solution:** GridCore runs in the browser and synchronizes edits over a WebSocket + CRDT (yjs) collaboration model.

| Area                    | What GridCore provides                                                    | Current note                                                             |
| ----------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Real-time collaboration | Shared session editing with yjs-backed text sync and presence/chat events | Structural file sync and some lifecycle flows need fixes (see AGENTS.md) |
| Session roles           | Owner / temp owner / regular user permission model                        | Server/client permission and ownership edge cases need hardening         |
| Web IDE UX              | Monaco editor, file tree, chat, session controls                          | UX and sync behavior must be aligned with canonical protocol             |
| Persistence             | Save/load session ZIPs to Postgres + Vercel Blob (owner-only flow)        | Blob download/storage path handling is currently a known critical issue  |

---

## Core architecture (non-negotiable)

> **Clients hold the state. The server is a message broker with a role-checker.**

- The WebSocket server authenticates users, checks permissions, and relays messages.
- The server does **not** store live file contents.
- yjs is the source of truth for file text; file trees/stores are mirrors for rendering and orchestration.
- When a user joins, an existing authorized client (owner or temp owner) provides session state/ZIP to the joiner through the server relay.

This architecture is defined and enforced by [`AGENTS.md`](./AGENTS.md).

---

## Features (implemented/in-progress)

- **Authentication:** NextAuth credentials login plus optional GitHub/Google OAuth
- **Session flows:** create, join, save, load, delete saved sessions (API/UI scaffolding present)
- **Collaborative editing:** Monaco editor + yjs document model for text synchronization
- **Presence & chat:** cursor/status/chat events and UI components
- **Ownership model:** main owner and temporary owner roles with restricted admin actions
- **Import/export:** ZIP-based codebase transfer primitives (client/server/storage integration present, but correctness fixes are required)

> For the authoritative behavior contract (permissions, protocol, data flows, limits), use `AGENTS.md`. The `docs/` tree contains specifications and historical design details and may drift from the current implementation.

---

## Tech stack

| Layer        | Choice                                            |
| ------------ | ------------------------------------------------- |
| Framework    | Next.js 14 (App Router)                           |
| Language     | TypeScript (`strict`)                             |
| UI           | React 18, Tailwind CSS, shadcn/ui, lucide-react   |
| Editor       | `@monaco-editor/react`                            |
| Realtime     | `yjs` + WebSocket (`ws`) message protocol         |
| Auth         | NextAuth 4 (JWT sessions) + bcrypt                |
| Database     | PostgreSQL + Drizzle ORM (`@vercel/postgres`)     |
| Blob storage | Vercel Blob (private)                             |
| Client state | Zustand                                           |
| Validation   | Zod                                               |
| Tests        | Jest (unit/integration) + Playwright (configured) |

---

## Quick start (local development)

### Prerequisites

- Node.js 18+ (20 LTS recommended)
- npm 9+
- PostgreSQL database (local or hosted)
- Vercel Blob token (required for save/load flows)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` from `.env.example` and fill in required values.

```bash
# macOS/Linux
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

Validate environment variables:

```bash
npm run validate:env
```

### 3. Prepare the database

```bash
npm run db:push
# optional seed
npm run db:seed
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** WebSocket upgrade/runtime behavior depends on the hosting/runtime environment. The current WS route includes platform-specific upgrade handling; verify behavior in your target runtime.

---

## Environment variables

Defined/validated by `lib/env.ts` and documented in `.env.example`.

### Required

| Variable                | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string                |
| `NEXTAUTH_SECRET`       | NextAuth/JWT secret (32+ chars)             |
| `NEXTAUTH_URL`          | App base URL (e.g. `http://localhost:3000`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token                |

### Optional

| Variable                                    | Purpose                                             |
| ------------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_WS_URL`                        | Override WebSocket URL (use `wss://` in production) |
| `GITHUB_ID` / `GITHUB_SECRET`               | GitHub OAuth (configure as a pair)                  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (configure as a pair)                  |
| `BLOB_STORAGE_REGION`                       | Blob storage region hint                            |
| `TEST_DATABASE_URL`                         | Database URL for integration tests                  |

### OAuth callback URLs (if enabled)

- `http://localhost:3000/api/auth/callback/github`
- `http://localhost:3000/api/auth/callback/google`

---

## Commands

```bash
# App
npm run dev
npm run build
npm start
npm run lint
npm run typecheck
npm run format
npm run validate:env

# Database
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
npm run db:drop
npm run db:reset
npm run db:seed

# Tests
npm test                 # Jest unit tests (jsdom)
npm run test:watch
npm run test:integration # Jest integration tests (node)
npm run test:e2e         # Playwright (configured)
npm run test:e2e:ui
```

> Some scripts depend on external services/runtime setup (database, blob storage, browser deps for Playwright). See `AGENTS.md` for quality gates and verification expectations.

---

## Project structure (high level)

```text
app/                  # Next.js App Router pages and API routes
components/           # UI, editor, session, chat, collaboration, layout components
hooks/                # Orchestration hooks (WebSocket, collaboration, file system, session, etc.)
stores/               # Zustand stores (session/file/editor/chat/ui/ws)
lib/                  # Auth, db, websocket, collaboration/yjs, file-system, storage, services, utils
types/                # Shared TypeScript types
__tests__/            # Jest unit/integration tests and test setup/helpers
docs/                 # Specification/design documentation (may drift; AGENTS.md is canonical)
scripts/              # DB/env helper scripts
```

---

## API and routes (overview)

### App routes

- `/` (landing, redirects authenticated users to sessions)
- `/login`, `/register`
- `/sessions`
- `/session/new`, `/session/join`, `/session/[id]`

### REST API (current)

- `POST /api/auth/register`
- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/[id]`
- `DELETE /api/sessions/[id]`
- `POST /api/sessions/[id]/save`
- `GET /api/sessions/check/[id]`
- `GET /api/users/me`

### WebSocket

- `GET /api/websocket` (upgrade endpoint; authenticated)
- Message envelope: `{ type, payload, timestamp? }`
- Canonical event sets, permission rules, and broadcast semantics are defined in `AGENTS.md`.

---

## Testing

Current repository state (audit snapshot):

- **Unit tests (Jest/jsdom):** present under `__tests__/unit/` (stores, permissions, file-system, collaboration)
- **Integration tests (Jest/node):** present under `__tests__/integration/` (`websocket.test.ts`)
- **E2E (Playwright):** configured, but no e2e specs were found in `__tests__/` during audit

Run tests:

```bash
npm test
npm run test:integration
npm run test:e2e
```

> Coverage thresholds are configured in Jest; expanding tests for protocol, permissions, sync convergence, and persistence is part of the master fix plan in `AGENTS.md`.

---

## Known constraints and current limitations

### Product/architecture limits (canonical)

- Max users per session: **20**
- Max saved sessions per user: **3**
- Max ZIP size: **50MB**
- Max single file size: **10MB**
- Max file name length: **255**
- Chat message length: **200 chars** (10s cooldown)
- WS message size limit: **1MB** (to be enforced consistently)
- Text files only (binary entries skipped/rejected per rules)
- One active session per user/tab behavior is intended

### Current implementation gaps (high priority)

A recent audit found issues that should be treated as blockers for production confidence, including (non-exhaustive):

- Incomplete owner reconnect/reclaim and temp-owner transition handling
- Under-authorized/under-validated `send:zip` relay path
- Missing client-side convergence handling for structural file events in some flows
- Permission gating mismatches in client file/import/export actions
- Broken/incorrect Vercel Blob download path handling for saved-session load
- Join/hydration and roster consistency gaps

**Source of truth for the full, prioritized issue list and fix phases:** [`AGENTS.md`](./AGENTS.md)

---

## Documentation

- [`AGENTS.md`](./AGENTS.md) — canonical architecture/contract, audit findings, and master fix plan (Builder/Reviewer guide)
- [`docs/`](./docs) — design/spec documentation by domain (overview, architecture, features, API, development, deployment, UI, testing)

When docs and implementation disagree, follow `AGENTS.md` and record/resolve drift explicitly.

---

## License

See repository metadata for license information. If a `LICENSE` file is added later, this section should link to it.
