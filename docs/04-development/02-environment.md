# GridCore - Environment Configuration

## 📋 Overview

This document covers all environment variables, their purposes, and how to configure them for different environments (development, staging, production).

---

## 🌍 Environment Files

| File              | Purpose                            |
| ----------------- | ---------------------------------- |
| `.env.local`      | Local development (not committed)  |
| `.env.example`    | Template for environment variables |
| `.env.production` | Production environment (Vercel)    |
| `.env.staging`    | Staging environment (Vercel)       |

---

## 📋 Environment Variables

### Core Variables

```env
# ─────────────────────────────────────────────────────────────
# Next.js
# ─────────────────────────────────────────────────────────────

NEXTAUTH_SECRET=your-secret-key-here
# Used for encrypting NextAuth JWT tokens
# Generate with: openssl rand -base64 32

NEXTAUTH_URL=http://localhost:3000
# The URL of your application
# For production: https://your-domain.com

NEXT_PUBLIC_APP_URL=http://localhost:3000
# Public URL for client-side usage

# ─────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────

DATABASE_URL=postgresql://user:password@localhost:5432/database
# PostgreSQL connection string
# Format: postgresql://[user[:password]@][host][:port][/database]

DATABASE_URL_POOL=postgresql://user:password@localhost:5432/database?pool=10
# Connection pooling URL (optional)

# ─────────────────────────────────────────────────────────────
# Authentication - NextAuth.js
# ─────────────────────────────────────────────────────────────

# GitHub OAuth
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ─────────────────────────────────────────────────────────────
# Storage - Vercel Blob
# ─────────────────────────────────────────────────────────────

BLOB_READ_WRITE_TOKEN=your-blob-token
# Token for Vercel Blob Storage

BLOB_STORAGE_REGION=auto
# Storage region (auto, us-east1, etc.)

# ─────────────────────────────────────────────────────────────
# WebSocket
# ─────────────────────────────────────────────────────────────

NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/websocket
# WebSocket endpoint URL
# For production: wss://your-domain.com/api/websocket

# ─────────────────────────────────────────────────────────────
# Feature Flags
# ─────────────────────────────────────────────────────────────

NEXT_PUBLIC_ENABLE_ANALYTICS=false
# Enable analytics tracking

NEXT_PUBLIC_ENABLE_LOGGING=false
# Enable client-side logging

# ─────────────────────────────────────────────────────────────
# Rate Limiting
# ─────────────────────────────────────────────────────────────

RATE_LIMIT_WINDOW_MS=60000
# Rate limit window in milliseconds (default: 1 minute)

RATE_LIMIT_MAX_REQUESTS=30
# Maximum requests per window

# ─────────────────────────────────────────────────────────────
# Session Limits
# ─────────────────────────────────────────────────────────────

MAX_USERS_PER_SESSION=20
# Maximum users per session

MAX_SAVED_SESSIONS_PER_USER=3
# Maximum saved sessions per user

MAX_ZIP_SIZE_MB=50
# Maximum ZIP file size in MB

# ─────────────────────────────────────────────────────────────
# Chat Limits
# ─────────────────────────────────────────────────────────────

CHAT_MAX_MESSAGE_LENGTH=200
# Maximum characters per chat message

CHAT_COOLDOWN_SECONDS=10
# Seconds between chat messages

# ─────────────────────────────────────────────────────────────
# Monitoring
# ─────────────────────────────────────────────────────────────

SENTRY_DSN=your-sentry-dsn
# Sentry error tracking (optional)

LOGTAIL_TOKEN=your-logtail-token
# Logtail logging (optional)
🔐 Getting OAuth Credentials
GitHub OAuth
Go to GitHub Settings → Developer settings → OAuth Apps

Click "New OAuth App"

Fill in:

Application name: GridCore (Dev)

Homepage URL: http://localhost:3000

Authorization callback URL: http://localhost:3000/api/auth/callback/github

Click "Register application"

Copy Client ID and Client Secret

Google OAuth
Go to Google Cloud Console → APIs & Services → Credentials

Click "Create Credentials" → "OAuth client ID"

Choose "Web application"

Set:

Name: GridCore (Dev)

Authorized JavaScript origins: http://localhost:3000

Authorized redirect URIs: http://localhost:3000/api/auth/callback/google

Click "Create"

Copy Client ID and Client Secret

🗄️ Database Configuration
Local PostgreSQL
env
DATABASE_URL=postgresql://postgres:password@localhost:5432/gridcore
Neon (Cloud)
env
DATABASE_URL=postgresql://user:password@ep-xxx-neon.tech/database?sslmode=require
Supabase
env
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
Vercel Postgres
env
POSTGRES_URL=postgresql://user:password@ep-xxx.xxx.vercel-storage.com/database
POSTGRES_PRISMA_URL=postgresql://user:password@ep-xxx.xxx.vercel-storage.com/database
POSTGRES_URL_NON_POOLING=postgresql://user:password@ep-xxx.xxx.vercel-storage.com/database
📦 Storage Configuration
Vercel Blob Storage
bash
# Create blob storage
vercel blob create

# Get token
vercel blob list

# Set environment variable
vercel env add BLOB_READ_WRITE_TOKEN
Alternative: Cloudflare R2
env
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_BUCKET_NAME=gridcore
🌐 Environment-Specific Configuration
Development (.env.local)
env
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/websocket

# Use local database
DATABASE_URL=postgresql://postgres:password@localhost:5432/gridcore

# Use local blob (if available) or mock
BLOB_READ_WRITE_TOKEN=local-dev-token

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_LOGGING=true

# Rate limiting (relaxed for development)
RATE_LIMIT_MAX_REQUESTS=100
Staging (.env.staging)
env
NEXTAUTH_URL=https://staging.your-domain.com
NEXT_PUBLIC_APP_URL=https://staging.your-domain.com
NEXT_PUBLIC_WS_URL=wss://staging.your-domain.com/api/websocket

# Use staging database
DATABASE_URL=postgresql://user:password@staging-db.com/database

# Use staging blob
BLOB_READ_WRITE_TOKEN=staging-blob-token

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_LOGGING=true

# Production-like limits
RATE_LIMIT_MAX_REQUESTS=30
Production (.env.production)
env
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_WS_URL=wss://your-domain.com/api/websocket

# Use production database
DATABASE_URL=postgresql://user:password@production-db.com/database

# Use production blob
BLOB_READ_WRITE_TOKEN=production-blob-token

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_LOGGING=false

# Production limits
RATE_LIMIT_MAX_REQUESTS=30
🔧 Validation
Validate Environment Variables
typescript
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  BLOB_READ_WRITE_TOKEN: z.string(),

  // Optional with defaults
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),
  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
})

export function validateEnv() {
  try {
    envSchema.parse(process.env)
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:', error.errors)
    }
    return { success: false, error }
  }
}
Validate Script
bash
# scripts/validate-env.ts
#!/usr/bin/env ts-node

import { validateEnv } from '../lib/env'

const result = validateEnv()
if (!result.success) {
  process.exit(1)
}
console.log('✅ Environment variables are valid')
```

## 📝 Vercel Configuration

### Set Environment Variables on Vercel

```bash
# Interactive
vercel env add DATABASE_URL

# From file
vercel env add --env .env.production

# Specific environment
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview

# List all
vercel env ls
```

### Vercel Dashboard

Go to project settings → Navigate to Environment Variables → Add variables for each environment:

- Production
- Preview
- Development

## 🧪 Testing Environment

```env
# .env.test
DATABASE_URL=postgresql://postgres:password@localhost:5432/gridcore_test
NEXTAUTH_SECRET=test-secret-key-for-testing
NEXTAUTH_URL=http://localhost:3000
BLOB_READ_WRITE_TOKEN=test-token
```

## 📊 Monitoring & Logging (Optional)

### Sentry

```env
SENTRY_DSN=https://xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx.ingest.sentry.io/xxx
```

### Logtail

```env
LOGTAIL_TOKEN=your-logtail-token
LOGTAIL_SOURCE_TOKEN=your-logtail-source-token
```

## ✅ Environment Checklist
□ NEXTAUTH_SECRET set (32+ chars)
□ DATABASE_URL configured
□ BLOB_READ_WRITE_TOKEN set
□ OAuth credentials added (if using)
□ NEXT_PUBLIC_WS_URL set (for production)
□ Rate limits configured
□ Feature flags set
□ Monitoring configured (optional)
□ Environment variables validated

Next: Read 03-folder-structure.md for project structure details.
```
