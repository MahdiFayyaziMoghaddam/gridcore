# GridCore

A real-time multiplayer IDE for the browser. Share a session ID and edit the same codebase
together — no installs, no servers to configure.

Built for pair programming, teaching, code review, and live technical interviews.

---

## Table of Contents

- [Core Idea](#core-idea)
- [Features](#features)
- [Architecture](#architecture)
- [Permissions](#permissions)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Commands](#commands)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Known Constraints](#known-constraints)

---

## Core Idea

> **Clients hold the state. The server is a message broker with a role-checker.**

The WebSocket server never stores file contents. It authenticates connections, enforces roles,
and relays messages. Every byte of your codebase lives in each participant's browser and in a
CRDT.

Three consequences shape the whole codebase:

1. **Collaboration is CRDT-native.** Every file is a `Y.Text` in one `Y.Doc` per session. yjs
   resolves concurrent edits by causal ordering — there is no hand-rolled diff merger.
2. **The server cannot answer "what's in this file?"** When someone joins, the server asks an
   existing client to hand over a ZIP, then relays it. The server is a postal service.
3. **Sessions are ephemeral.** A session lives only while its owner (or a temporary owner) is
   connected. Disconnect is instant removal; there is no grace period.

---

## Features

|                       |                                                                             |
| --------------------- | --------------------------------------------------------------------------- |
| **Real-time editing** | CRDT-backed collaborative editing with remote cursor and selection presence |
| **Monaco editor**     | VS Code's editor, lazy-loaded, with minimap and syntax highlighting         |
| **Session roles**     | Owner, temporary owner, and regular user — enforced server-side             |
| **Import / Export**   | Round-trip a codebase through a ZIP (50MB cap)                              |
| **Chat**              | In-memory chat with length limit and per-user cooldown                      |
| **Presence**          | See who is online, which file they are in, and their activity state         |
| **Save & restore**    | Sessions persist to PostgreSQL + private blob storage                       |
| **Auth**              | Email/password (bcrypt) plus optional GitHub and Google OAuth               |
| **Session handover**  | Owner can transfer operational control without transferring ownership       |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT                                                     │
│  ┌───────────┐ ┌─────────┐ ┌──────────┐ ┌────────────────┐ │
│  │ Next.js   │ │ Monaco  │ │ yjs CRDT │ │ Zustand stores │ │
│  │ (React)   │ │ Editor  │ │ (Y.Doc)  │ │                │ │
│  └─────┬─────┘ └────┬────┘ └────┬─────┘ └───────┬────────┘ │
│        └────────────┴───────────┴───────────────┘          │
│                          │                                 │
│              ┌───────────▼────────────┐                     │
│              │ WebSocket (WSS)        │                     │
│              │ diff · cursor · chat   │                     │
│              │ file:* · ownership:*   │                     │
│              └───────────┬────────────┘                     │
└──────────────────────────┼──────────────────────────────────┘
                           │ WSS
┌──────────────────────────▼──────────────────────────────────┐
│  SERVER (stateless, in-memory)                             │
│                                                             │
│  Connection Handler → Message Router → Session Manager      │
│         │                   │                 │             │
│         └──────── Zod validation + rate limit ─┘            │
│                                                             │
│  State: sessions · connections · sessionMap · rateLimits    │
│         · chatCooldowns                                     │
│                                                             │
│  Broadcast only. Never sees or stores file contents.        │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│  POSTGRES (Drizzle)          VERCEL BLOB (private)          │
│  users · sessions            /sessions/{id}/codebase.zip    │
│         · user_sessions      ≤ 50MB                         │
└─────────────────────────────────────────────────────────────┘
```

### How a client joins

The server has no files, so it borrows them:

```
new client  → join
server      → request:zip { targetUserId } → owner client
owner       → builds ZIP + yjs state from its own document
owner       → send:zip { targetUserId, zip, state }
server      → receive:zip { zip, state } → new client
new client  → applies the yjs state, file tree renders
```

The **yjs state update matters**. A client that retyped the ZIP text into its own document would
have independent CRDT history, and subsequent incremental updates would silently fail to merge.

### How a session saves

The client owns ZIP creation; the server owns persistence:

```
owner client → createZip() → reject if > 50MB
             → POST /api/sessions/:id/save { zip: base64 }
server       → decode → re-check 50MB → upload → DB write → broadcast session:saved
```

The 50MB ceiling is enforced at three layers on purpose: client, route, and storage service.

---

## Permissions

Three roles, one source of truth: `checkPermission(sessionId, userId, permission)` in
`lib/websocket/permissions.ts`. Both server handlers and client hooks route through it — there is
no ad-hoc `isOwner &&` logic anywhere.

| Action                            | Owner |       Temp Owner        | Regular User |
| --------------------------------- | :---: | :---------------------: | :----------: |
| Create session                    |  ✅   |           ❌            |      ❌      |
| Join / leave                      |  ✅   |           ✅            |      ✅      |
| View files, chat                  |  ✅   |           ✅            |      ✅      |
| Edit file contents                |  ✅   |           ✅            |      ✅      |
| Create / delete / rename files    |  ✅   |           ✅            |      ❌      |
| Save / export / change session ID |  ✅   |           ❌            |      ❌      |
| Grant / revoke temp owner         |  ✅   |           ❌            |      ❌      |
| Close session                     |  ✅   | ✅ _owner offline only_ |      ❌      |

Rules worth knowing:

- **Ownership is never transferred.** The main owner stays `ownerId`. If they leave with a temp
  owner present, the session survives and the owner **reclaims automatically** on reconnect.
- **Owner disconnects with no temp owner → the session closes**, even if other users remain.
- A temp owner can edit live files but has **no storage rights** — blob access is owner-only. This
  asymmetry is intentional.

---

## Tech Stack

| Layer        | Choice                                       | Version                |
| ------------ | -------------------------------------------- | ---------------------- |
| Framework    | Next.js (App Router)                         | 14.2.33                |
| UI           | React / Tailwind / shadcn/ui / lucide-react  | 18.3 / 3.4 / — / 0.427 |
| Editor       | `@monaco-editor/react` (lazy, `ssr: false`)  | 4.6                    |
| Realtime     | `yjs` CRDT + `ws`                            | 13.6 / 8.18            |
| Auth         | NextAuth (credentials + OAuth, JWT 24h)      | 4.24                   |
| Passwords    | `bcryptjs`, cost 10                          | 2.4                    |
| Database     | PostgreSQL + Drizzle ORM                     | 0.29                   |
| Blob storage | `@vercel/blob`, private access               | 2.8                    |
| Client state | Zustand                                      | 4.5                    |
| Validation   | Zod at every trust boundary                  | 3.23                   |
| ZIP          | JSZip                                        | 3.10                   |
| Tests        | Jest (unit + integration) / Playwright (e2e) | 29.7 / 1.45            |

---

## Quick Start

### Prerequisites

- Node.js 18+ (20 LTS recommended)
- npm 9+
- PostgreSQL 14+, local or hosted

### Install and run

```bash
git clone <repo-url> gridcore
cd gridcore

npm install

cp .env.example .env.local    # then fill it in — see below
npm run validate:env          # fails fast on bad config

npm run db:push               # apply schema
npm run db:seed               # optional: test@example.com / password123

npm run dev
```

Open <http://localhost:3000>. Create an account, start a session, and copy the session ID from
the toolbar to invite someone.

---

## Environment Variables

Copy `.env.example` to `.env.local`. Validation is enforced by Zod in `lib/env.ts`.

### Required

| Variable                | Notes                                                       |
| ----------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`          | `postgresql://user:pass@host:5432/db`                       |
| `NEXTAUTH_SECRET`       | **32+ characters.** Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL`          | `http://localhost:3000` locally, your domain in production  |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token                                           |

### Optional

| Variable                                    | Notes                                                           |
| ------------------------------------------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_WS_URL`                        | `ws://localhost:3000/api/websocket`; use `wss://` in production |
| `GITHUB_ID` / `GITHUB_SECRET`               | Both or neither — a half-configured provider is skipped         |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Same                                                            |
| `BLOB_STORAGE_REGION`                       | Defaults to `auto`                                              |
| `TEST_DATABASE_URL`                         | Only needed for integration tests                               |

### OAuth callback URLs

```
http://localhost:3000/api/auth/callback/github
http://localhost:3000/api/auth/callback/google
```

---

## Commands

```bash
# Development
npm run dev                    # dev server
npm run build && npm start     # production build, then serve

# Quality
npm run lint                   # ESLint (no-explicit-any is an error)
npm run typecheck              # tsc --noEmit
npm run format                 # Prettier

# Database
npm run db:generate            # generate a migration
npm run db:push                # push schema to the dev database
npm run db:migrate             # apply pending migrations
npm run db:studio              # Drizzle Studio
npm run db:seed                # seed a test user and session
npm run db:reset               # drop and recreate (dev only, prompts first)

# Testing
npm test                       # unit tests (jsdom)
npm run test:integration       # WebSocket/API integration tests (node)
npm run test:e2e               # Playwright end-to-end

# Environment
npm run validate:env           # verify required variables are set
```

**Migration rules:** every migration exports both `up(db)` and `down(db)`, all DDL is idempotent
(`IF NOT EXISTS` / `IF EXISTS`), and multi-statement work is transactional.

---

## Project Structure

```
gridcore/
├── app/
│   ├── (auth)/                # /login, /register  (no URL prefix)
│   ├── (dashboard)/           # /sessions, /session/*
│   └── api/
│       ├── auth/              # NextAuth + register
│       ├── sessions/          # list, create, load, delete, save, check
│       ├── users/me/          # current user
│       └── websocket/         # upgrade + message handling
├── components/
│   ├── ui/                    # shadcn/ui primitives
│   ├── layout/                # Navbar, Sidebar, StatusBar, UserMenu
│   ├── editor/                # Editor, EditorTabs, FileTree, FileIcon
│   ├── collaboration/         # UserList
│   ├── chat/                  # ChatPanel
│   ├── session/               # SessionControls, SessionWorkspace
│   └── auth/                  # LoginForm, RegisterForm
├── lib/
│   ├── websocket/             # state, permissions, validation, client, server
│   ├── collaboration/         # yjs document manager, awareness
│   ├── file-system/           # tree helpers, security, import
│   ├── storage/               # blob service, zip
│   ├── db/                    # schema, queries, migrations
│   ├── auth/                  # NextAuth config, password policy
│   ├── constants.ts           # every limit in the system
│   ├── routes.ts              # route map (server-safe)
│   └── api-handler.ts         # auth + rate limit + typed error mapping
├── stores/                    # Zustand, one store per domain
├── hooks/                     # orchestration only — no state ownership
├── types/
└── __tests__/{unit,integration,e2e}/
```

**State ownership is strict.** Each store owns one domain, hooks own nothing, and components
select from stores. `useState` is reserved for ephemeral UI (expanded folders, an open context
menu, a rename input).

---

## Testing

```bash
npm test                    # 74 unit tests, jsdom
npm run test:integration    # 23 integration tests, node
npm run test:e2e            # Playwright — needs browsers installed
```

Coverage threshold is **70%** globally. Integration tests default to a throwaway
`gridcore_test` database and never touch your development data.

The permission model, file-tree manipulation, path validation, password policy, and CRDT
replication are each covered by dedicated tests — these are the parts where a silent regression
is expensive.

---

## Deployment

Built for Vercel.

1. Provision Postgres (Vercel Postgres, Neon, or Supabase) and a Vercel Blob store.
2. Set the required environment variables per environment (Production / Preview / Development).
3. Deploy. WebSockets require a runtime that supports connection upgrades; the route returns
   `501` with a clear message on runtimes that do not.
4. Apply migrations: `npm run db:migrate`.

State is in-memory, so **any server restart drops active sessions**. That is inherent to the
design, not a bug — sessions were never durable until saved.

---

## Security

- **Authentication** required for every route except `/login`, `/register`, `/api/auth`.
- **Passwords** hashed with bcrypt (cost 10). Policy: 8–100 characters with at least one
  uppercase, one lowercase, and one digit.
- **Session IDs** are UUID v4 — unguessable. The server always generates them; a client-supplied
  value is never used as a key.
- **Payload validation** with Zod on every inbound WebSocket event and API body.
- **Rate limiting** at 30 requests/minute/user, plus a 10-second chat cooldown.
- **Path traversal** is rejected on import: `..`, absolute paths, backslashes, and drive letters
  are refused outright rather than sanitized.
- **Binary content** is detected and skipped, never silently written.
- **Blob access** is owner-only and private.
- **No secrets in logs**, client storage, or error responses. Internal errors return a generic
  message.

---

## Known Constraints

These are deliberate design boundaries:

| Limit                             | Value                   |
| --------------------------------- | ----------------------- |
| Users per session                 | 20                      |
| Saved sessions per user           | 3                       |
| ZIP size (import / export / save) | 50MB                    |
| Single file size                  | 10MB                    |
| File name length                  | 255 characters          |
| Chat message length               | 200 characters          |
| Chat cooldown                     | 10 seconds              |
| Rate limit                        | 30 requests / minute    |
| WebSocket message                 | 1MB                     |
| File types                        | Text only — no binaries |

Operational notes:

- Server state is per-instance and in-memory. Horizontal scaling requires shared state (Redis)
  and sticky sessions.
- Sessions are lost on deploy or restart unless saved.
- Dark theme only, desktop-first (usable on tablets).
- One tab per user, enforced via LocalStorage heartbeat.

---

## Documentation

The [`docs/`](./docs) tree contains the full specification across eight sections: project
overview, architecture, features, development, API, deployment, UI, and testing.

[`AGENTS.md`](./AGENTS.md) is the operating manual for coding agents — it distills the
non-negotiable rules, the permission model, and the resolved contradictions in the spec.

---

## License

MIT
