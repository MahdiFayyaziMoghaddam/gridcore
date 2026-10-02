# GridCore - Development Setup

## 📋 Overview

This guide covers setting up the GridCore development environment from scratch. Follow these steps to get a local development instance running.

---

## 🖥️ System Requirements

### Minimum Requirements

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **PostgreSQL**: v14.x or higher
- **Git**: v2.x or higher

### Recommended

- **Node.js**: v20.x (LTS)
- **npm**: v10.x
- **Docker**: For local database (optional)

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/gridcore.git
cd gridcore

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Set up database
npm run db:push

# 5. Start development server
npm run dev
Open http://localhost:3000 to view the application.

```bash
```

## 📦 Step-by-Step Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/gridcore.git
cd gridcore
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation
npm ls --depth=0
```

### 3. Environment Configuration

Create `.env.local` in the root directory:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/gridcore

# Auth (NextAuth.js)
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# OAuth Providers (Optional for development)
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your-blob-token

# WebSocket
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/websocket
```

Generate `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 4. Database Setup

```bash
# Verify it's running
docker ps
```

#### Option B: Local PostgreSQL

```bash
# Install PostgreSQL (macOS)
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb gridcore

# Install PostgreSQL (Ubuntu)
sudo apt-get install postgresql-14
sudo -u postgres createdb gridcore
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'password';"
```

#### Option C: Cloud Database (Free)

Use a free PostgreSQL provider:

- Neon: https://neon.tech
- Supabase: https://supabase.com
- Vercel Postgres: https://vercel.com/docs/storage/vercel-postgres

### 5. Run Migrations

```bash
# Push schema to database
npm run db:push

# Generate migration files
npm run db:generate

# Open Drizzle Studio
npm run db:studio
```

### 6. Vercel Blob Storage Setup
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

### 6. Vercel Blob Storage Setup

```bash
# Create blob storage
vercel blob create

# Copy the BLOB_READ_WRITE_TOKEN to .env.local
```

### 7. Start Development Server

```bash
# Start in development mode
npm run dev

# The app will be available at http://localhost:3000
```

## 🛠️ Development Tools

### VS Code Extensions (Recommended)

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "yoavbls.pretty-ts-errors",
    "mikestead.dotenv",
    "vivaxy.vscode-conventional-commits",
    "ms-vscode-remote.remote-containers"
  ]
}
```

### VS Code Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

## 🔧 Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Reset database
npm run db:reset

# Check connection string
```
echo $DATABASE_URL

### WebSocket Connection Issues

```bash
# Check WebSocket URL
echo $NEXT_PUBLIC_WS_URL

# Verify WebSocket route exists
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
  http://localhost:3000/api/websocket
```

### Vercel Blob Storage Issues

```bash
# Verify token is set
echo $BLOB_READ_WRITE_TOKEN

# Test blob connection
npm run test:blob
```

### Dependency Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for outdated packages
npm outdated

# Update packages
npm update
```

## 📁 Project Structure (First Look)

```
gridcore/
```
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Main app pages
│   └── api/               # API routes
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/                   # Core libraries
├── stores/                # Zustand stores
├── types/                 # TypeScript types
├── utils/                 # Utilities
├── public/                # Static assets
├── scripts/               # Development scripts
├── .env.example           # Environment variables template
├── drizzle.config.ts      # Drizzle configuration
├── next.config.js         # Next.js configuration
├── package.json           # Dependencies
├── tailwind.config.ts     # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
## 🧪 Test Setup

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- file-management.test.ts

# Run E2E tests
npm run test:e2e

# Run E2E with UI
npm run test:e2e:ui
```

## 📦 Useful Commands

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint
npm run format           # Format with Prettier

# Database
npm run db:push          # Push schema to database
npm run db:generate      # Generate migrations
npm run db:studio        # Open Drizzle Studio
npm run db:reset         # Reset database

# Testing
npm test                 # Run tests
npm run test:e2e         # Run E2E tests

# Deployment
npm run build            # Build
vercel deploy           # Deploy to Vercel
```

## 📝 Development Checklist

- [ ] Node.js installed (v18+)
- [ ] npm installed
- [ ] Git installed
- [ ] PostgreSQL installed/running
- [ ] Repository cloned
- [ ] Dependencies installed
- [ ] .env.local configured
- [ ] Database created
- [ ] Migrations run
- [ ] Vercel Blob configured
- [ ] Development server running
- [ ] App accessible at localhost:3000
- [ ] Database accessible
- [ ] WebSocket connection working

Next: Read [02-environment.md](02-environment.md) for environment configuration details.
