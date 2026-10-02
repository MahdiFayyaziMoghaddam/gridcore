# GridCore - Environment Setup

## 📋 Overview

This document covers setting up all the required services and infrastructure for GridCore in different environments (development, staging, production).

---

## 🗄️ Database Setup

### Vercel Postgres (Recommended)

```bash
# 1. Create database
vercel postgres create --name gridcore-db

# 2. Get connection string
vercel postgres pull

# 3. Run migrations
npm run db:push

# 4. Verify connection
psql $DATABASE_URL -c "SELECT 1"
### Neon Database

```bash
# 1. Create Neon project
neon projects create --name gridcore

# 2. Get connection string
neon projects get --name gridcore --connection-string

# 3. Set environment variable
export DATABASE_URL="postgresql://..."

# 4. Run migrations
npm run db:push
```

### Supabase

```bash
# 1. Create Supabase project
# 2. Get connection string from dashboard
# 3. Set environment variable
export DATABASE_URL="postgresql://..."

# 4. Run migrations
npm run db:push
```

## 📦 Storage Setup

### Vercel Blob Storage

```bash
# 1. Create blob storage
vercel blob create

# 2. Get token
vercel blob list

# 3. Set environment variable
export BLOB_READ_WRITE_TOKEN="your-token"

# 4. Test connection
npm run test:storage
```

### Cloudflare R2

```bash
# 1. Create R2 bucket
wrangler r2 bucket create gridcore

# 2. Get credentials
wrangler r2 bucket list

# 3. Set environment variables
export R2_ACCESS_KEY_ID="your-access-key"
export R2_SECRET_ACCESS_KEY="your-secret-key"
export R2_ENDPOINT="https://xxx.r2.cloudflarestorage.com"
export R2_BUCKET_NAME="gridcore"
```

### AWS S3

```bash
# 1. Create S3 bucket
aws s3 mb s3://gridcore

# 2. Create IAM user with S3 access
aws iam create-user --user-name gridcore-storage

# 3. Get credentials
aws iam create-access-key --user-name gridcore-storage

# 4. Set environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
export AWS_BUCKET_NAME="gridcore"
```

## 🔑 OAuth Setup

### GitHub OAuth

```bash
# 1. Go to GitHub Settings → Developer settings → OAuth Apps
# 2. Click "New OAuth App"
# 3. Fill in:
#    - Application name: GridCore
#    - Homepage URL: https://your-domain.com
#    - Authorization callback URL: https://your-domain.com/api/auth/callback/github
# 4. Get Client ID and Client Secret
# 5. Set environment variables
export GITHUB_ID="your-client-id"
export GITHUB_SECRET="your-client-secret"
```

### Google OAuth

```bash
# 1. Go to Google Cloud Console → APIs & Services → Credentials
# 2. Click "Create Credentials" → "OAuth client ID"
# 3. Choose "Web application"
# 4. Set:
#    - Name: GridCore
#    - Authorized JavaScript origins: https://your-domain.com
#    - Authorized redirect URIs: https://your-domain.com/api/auth/callback/google
# 5. Get Client ID and Client Secret
# 6. Set environment variables
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
```

## 🌐 Domain Setup

### Custom Domain on Vercel

```bash
# 1. Add domain in Vercel dashboard
# 2. Configure DNS records
#    - CNAME: your-domain.com → cname.vercel-dns.com
#    - TXT: _vercel.your-domain.com → vercel-domain-config
# 3. Wait for DNS propagation
# 4. Verify domain
vercel domains verify your-domain.com
```

### SSL Certificate

```bash
# Vercel automatically provisions SSL certificates
# For custom domains, ensure SSL is enabled
vercel domains inspect your-domain.com
```

## 🔐 Security Setup

### Environment Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate JWT secret
openssl rand -base64 32

# Generate encryption key
openssl rand -base64 32
```

### Rate Limiting Configuration

```typescript
// lib/rate-limit-config.ts
export const rateLimitConfig = {
  // General rate limit
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute

  // Authentication rate limit
  auth: {
    windowMs: 60 * 1000,
    max: 5, // 5 login attempts per minute
  },

  // File operations rate limit
  files: {
    windowMs: 60 * 1000,
    max: 20, // 20 file operations per minute
  },

  // Chat rate limit
  chat: {
    windowMs: 10 * 1000, // 10 seconds
    max: 1, // 1 message per 10 seconds
  },
}
```

## 📊 Monitoring Setup

### Vercel Analytics

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Sentry Error Tracking

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})
```

### Logtail Logging

```typescript
// lib/logger.ts
import { Logtail } from '@logtail/node'

const logtail = new Logtail(process.env.LOGTAIL_TOKEN)

export const logger = {
  info: (message: string, data?: any) => {
    console.log(message, data)
    logtail.info(message, data)
  },
  error: (message: string, error?: any) => {
    console.error(message, error)
    logtail.error(message, { error })
  },
  warn: (message: string, data?: any) => {
    console.warn(message, data)
    logtail.warn(message, data)
  },
}
```

## 🧪 Environment Validation

File: `scripts/validate-env.ts`

```typescript
import { z } from 'zod'

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  BLOB_READ_WRITE_TOKEN: z.string(),

  // Optional
  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  LOGTAIL_TOKEN: z.string().optional(),
})

function validateEnv() {
  try {
    envSchema.parse(process.env)
    console.log('✅ Environment variables are valid')
    return true
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:')
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
    }
    return false
  }
}

if (!validateEnv()) {
  process.exit(1)
}
```

## 📋 Environment Setup Checklist

### Development Environment

- [ ] PostgreSQL installed or cloud database created
- [ ] Database created and migrations run
- [ ] Vercel Blob Storage set up
- [ ] OAuth credentials configured
- [ ] Environment variables set in .env.local
- [ ] WebSocket endpoint accessible
- [ ] Development server running

### Staging Environment

- [ ] Separate database created
- [ ] Storage bucket created
- [ ] OAuth credentials configured for staging
- [ ] Environment variables set in Vercel
- [ ] Preview deployment working
- [ ] WebSocket connections working

### Production Environment

- [ ] Production database created and migrated
- [ ] Storage bucket created
- [ ] OAuth credentials configured for production
- [ ] Environment variables set in Vercel
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Monitoring and logging set up
- [ ] Backup strategy implemented

## 🚨 Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity"

# Reset connection
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database()"
```

### Storage Connection Issues

```bash
# Test blob connection
curl -X GET "https://blob.vercel-storage.com/your-bucket" \
  -H "Authorization: Bearer $BLOB_READ_WRITE_TOKEN"

# List files
vercel blob list
```
WebSocket Connection Issues
bash
# Test WebSocket endpoint
wscat -c wss://your-domain.com/api/websocket

# Check logs
vercel logs --follow
OAuth Issues
bash
# Check callback URLs
# Verify redirect URIs match exactly
# Check scopes are correct
# Review error logs
Next: Read 03-monitoring.md for monitoring and logging setup.
```
