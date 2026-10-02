# GridCore - Project Introduction

## 📖 What is GridCore?

GridCore is a **real-time multiplayer Integrated Development Environment (IDE)** built for the web. It allows multiple users to collaborate on code simultaneously, making it ideal for pair programming, code reviews, teaching, and team collaboration.

The name "GridCore" reflects the project's core philosophy: **grid-based collaboration** where multiple users work together seamlessly on a shared codebase.

---

## 🎯 Project Goals

### Primary Goals

1. **Real-time Collaboration**: Enable multiple users to edit the same files simultaneously with minimal latency
2. **Zero Setup**: Users can start coding immediately without installation or configuration
3. **Web-Based**: Accessible from any modern browser, no downloads required
4. **Lightweight**: Fast loading times and responsive UI
5. **Scalable**: Support up to 20 concurrent users per session

### Secondary Goals

1. **Educational**: Perfect for teaching coding, conducting workshops, and mentoring
2. **Developer-Friendly**: Familiar VSCode-like experience
3. **Secure**: Safe collaboration environment with authentication
4. **Open**: Support for all text-based file formats

---

## 🏗️ Project Vision

GridCore aims to become the **go-to collaborative coding platform** for:

- **Software Teams**: Remote pair programming and code reviews
- **Educational Institutions**: Teaching programming classes
- **Open Source Contributors**: Collaborative coding sessions
- **Hackathons**: Real-time collaboration during events

---

## 🎨 Core Principles

### 1. Client-Centric Architecture

- **Clients are the source of truth** for all codebase state
- **Server is a lightweight messenger** that broadcasts changes
- **No server-side file storage** in memory (only database/storage for saved sessions)
- **All processing happens on the client** (ZIP operations, diff generation)

### 2. Ownership-Driven Sessions

- **Sessions are tied to their owner** (the creator)
- **Sessions live only while the owner is online** (or a temp owner)
- **Owners have full control** over their sessions (save, export, change ID)
- **Temp owners** can keep sessions alive and create/delete files

### 3. Simplicity First

- **Minimal dependencies**: Only essential libraries
- **No complex infrastructure**: Works with free-tier services
- **Simple state management**: In-memory server state, client-side state management
- **Clear separation of concerns**: Auth, sessions, collaboration, file management

### 4. Security by Design

- **Authentication required** for all actions
- **Session IDs are UUIDs** (not guessable)
- **Rate limiting** prevents abuse
- **Owner-controlled access** via session ID changes

---

## 📊 Target Audience

### Primary Users

1. **Developers** who want to collaborate on code in real-time
2. **Educators** teaching programming to students
3. **Students** learning to code with peers
4. **Technical Interviewers** conducting live coding interviews

### User Personas

#### Persona 1: The Remote Developer

- **Name**: Alex
- **Role**: Full-stack developer at a distributed team
- **Use Case**: Pair programming sessions with teammates
- **Needs**: Real-time editing, cursor tracking, chat

#### Persona 2: The Teacher

- **Name**: Maria
- **Role**: Computer science professor
- **Use Case**: Teaching coding to a class of 20 students
- **Needs**: Ability to share code, see student progress, provide feedback

#### Persona 3: The Student

- **Name**: John
- **Role**: Computer science student
- **Use Case**: Collaborating on projects with classmates
- **Needs**: Simple interface, real-time updates, file management

#### Persona 4: The Interviewer

- **Name**: Sarah
- **Role**: Technical recruiter
- **Use Case**: Conducting live coding interviews
- **Needs**: Code editor, ability to view candidate's code, secure session

---

## 🚀 Key Use Cases

### Use Case 1: Creating a Session

1. User logs in to GridCore
2. Clicks "New Session"
3. Optionally names the session
4. Gets a session ID (UUID) to share with others

### Use Case 2: Joining a Session

1. User enters the session ID
2. Server checks if the session is active (owner online)
3. User receives the current codebase from the owner
4. User joins the session with all features enabled

### Use Case 3: Collaborative Editing

1. Users open files and start editing
2. Edits are synced in real-time using yjs
3. Cursor positions are broadcasted to all users
4. Users can see who is editing which file

### Use Case 4: Saving a Session

1. Owner clicks "Save Session"
2. Client creates a ZIP of the entire codebase
3. ZIP is uploaded to Vercel Blob Storage
4. Session metadata is saved to the database
5. Session appears in the owner's saved sessions list

### Use Case 5: Importing a Codebase

1. Owner imports a ZIP file (max 50MB)
2. Client extracts the ZIP
3. File tree is displayed in the sidebar
4. All users can see and edit the files

### Use Case 6: Exporting a Codebase

1. Owner clicks "Export Session"
2. Client creates a ZIP of the entire codebase
3. ZIP is downloaded to the user's local machine

### Use Case 7: Changing Session ID

1. Owner wants to block new users from joining
2. Owner changes the session ID
3. Old ID immediately becomes invalid
4. Current users stay connected with the new ID

### Use Case 8: Granting Temp Ownership

1. Owner grants temp ownership to a trusted user
2. Temp owner can now create/delete files
3. If owner disconnects, temp owner keeps session alive
4. Owner can revoke temp ownership at any time

---

## 🔗 Dependencies

### Core Dependencies

| Package | Version | Purpose |
| ------- | ------- | ------- |
| Next.js | 14.x | Framework |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| Drizzle ORM | 0.29.x | Database ORM |
| NextAuth.js | 4.x | Authentication |
| yjs | 13.x | CRDT for collaboration |
| Monaco Editor | 0.44.x | Code editor |
| Tailwind CSS | 3.x | Styling |
| Shadcn UI | Latest | UI components |
| Zustand | 4.x | State management |
| `ws` | 8.x | WebSocket library |

### Development Dependencies

| Package | Purpose |
| ------- | ------- |
| Jest | Unit testing |
| Playwright | E2E testing |
| ESLint | Code linting |
| Prettier | Code formatting |

---

## 📈 Success Metrics

### Technical Metrics

- **Session creation time**: < 1 second
- **Diff broadcast latency**: < 100ms
- **Max concurrent users**: 20 per session
- **Max saved sessions**: 3 per user
- **Max file size**: 50MB ZIP
- **Uptime**: 99.9%

### User Experience Metrics

- **Time to first interaction**: < 3 seconds
- **User satisfaction**: > 90%
- **Session duration**: Average 30 minutes
- **Feature adoption**: > 80% use collaboration features

---

## 🔮 Future Considerations

### Potential Enhancements

1. **Voice/Video Chat**: Real-time communication within sessions
2. **Code Execution**: Run code directly in the browser (sandboxed)
3. **Version History**: Track changes over time
4. **Git Integration**: Push/pull from GitHub repositories
5. **Custom Themes**: User-selectable themes
6. **Plugin System**: Extend functionality with plugins
7. **Mobile Support**: Optimized for mobile devices
8. **Enterprise Features**: SSO, advanced security, audit logs

### Scalability Considerations

1. **Redis Integration**: For shared state across multiple WebSocket instances
2. **Horizontal Scaling**: Multiple WebSocket server instances
3. **Database Optimization**: Indexing, caching
4. **CDN Integration**: For serving assets and ZIP files

---

## 📋 Glossary

| Term | Definition |
| ---- | ---------- |
| **Session** | A collaborative coding session with a unique ID |
| **Owner** | The user who created the session (full control) |
| **Temp Owner** | A user granted temporary ownership (can create/delete files) |
| **Codebase** | The entire file tree and contents of a session |
| **Diff** | A set of changes to a file (insertions, deletions) |
| **yjs** | A CRDT library for real-time collaboration |
| **CRDT** | Conflict-free Replicated Data Type (ensures consistency) |
| **Vercel Blob** | Cloud storage service by Vercel |
| **Drizzle** | TypeScript ORM for PostgreSQL |

---

## 📝 Version History

| Version | Date | Changes |
| ------- | ---- | ------- |
| 1.0.0 | Current | Initial release specification |

---

**Next**: Read [02-constraints.md](02-constraints.md) for project constraints and limits.
