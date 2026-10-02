# GridCore - Vercel Deployment Configuration

## 📋 Overview

This document covers the deployment configuration for GridCore on Vercel. It includes setup instructions, configuration files, environment variables, and deployment workflows.

---

## 🏗️ Vercel Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Vercel Deployment │
├─────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Production │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Next.js │ │ WebSocket │ │ PostgreSQL │ │ │
│ │ │ App │ │ Server │ │ (Vercel │ │ │
│ │ │ (Serverless)│ │ (Edge) │ │ Postgres) │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ │ │ │
│ │ ┌──────────────────────────────────────────────────────────┐ │ │
│ │ │ Vercel Blob Storage │ │ │
│ │ │ /sessions/{id}/codebase.zip │ │ │
│ │ └──────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Preview (Staging) │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Preview │ │ Preview │ │ Preview │ │ │
│ │ │ App │ │ WebSocket │ │ Database │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────┘
```

---
```

## 📦 Vercel Configuration File

### File: `vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/websocket",
      "dest": "/api/websocket",
      "upgrade": true
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "env": {
    "NEXTAUTH_URL": "https://${VERCEL_URL}",
    "NEXTAUTH_SECRET": "@nextauth_secret"
  },
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 10,
      "memory": 1024
    },
    "api/websocket/**/*.ts": {
      "maxDuration": 60,
      "memory": 1024,
      "runtime": "edge"
    }
  },
  "regions": ["iad1"],
  "crons": [],
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
📁 Next.js Configuration
File: next.config.js
javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ──── Runtime ──────────────────────────────────────────────

  experimental: {
    serverActions: true,
  },

  // ──── Webpack ──────────────────────────────────────────────

  webpack: (config, { isServer }) => {
    // Handle WebSocket in edge runtime
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: false,
      }
    }

    // Add polyfills for browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }

    return config
  },

  // ──── Images ──────────────────────────────────────────────

  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
  },

  // ──── Headers ─────────────────────────────────────────────

  async headers() {
    return [
      {
        source: '/api/websocket',
        headers: [
          { key: 'Upgrade', value: 'websocket' },
          { key: 'Connection', value: 'Upgrade' },
          { key: 'Sec-WebSocket-Version', value: '13' },
        ],
      },
    ]
  },

  // ──── Environment ──────────────────────────────────────────

  env: {
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },

  // ──── Output ──────────────────────────────────────────────

  output: 'standalone',
}

module.exports = nextConfig
🔧 Environment Variables
Vercel Environment Variables
bash
# Add environment variables via CLI
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_SECRET preview
vercel env add BLOB_READ_WRITE_TOKEN production
vercel env add BLOB_READ_WRITE_TOKEN preview

# Add sensitive variables
vercel env add GITHUB_ID production --secret
vercel env add GITHUB_SECRET production --secret
vercel env add GOOGLE_CLIENT_ID production --secret
vercel env add GOOGLE_CLIENT_SECRET production --secret

# Link environment variables to project
vercel env pull
Required Variables
Variable	Description	Example
DATABASE_URL	PostgreSQL connection string	postgresql://...
NEXTAUTH_SECRET	NextAuth secret key	32+ chars random
NEXTAUTH_URL	App URL	https://gridcore.vercel.app
BLOB_READ_WRITE_TOKEN	Vercel Blob token	token...
GITHUB_ID	GitHub OAuth client ID	Iv1...
GITHUB_SECRET	GitHub OAuth secret	...
GOOGLE_CLIENT_ID	Google OAuth client ID	...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET	Google OAuth secret	...
NEXT_PUBLIC_WS_URL	WebSocket URL	wss://gridcore.vercel.app/api/websocket
📊 Database Setup
Vercel Postgres
bash
# Create a Postgres database
vercel postgres create

# Link to project
vercel postgres link

# Get connection string
vercel postgres pull

# Set environment variables
vercel env add DATABASE_URL "$(vercel postgres url)" production
Neon Database
bash
# Create Neon project
neon projects create --name gridcore

# Get connection string
neon projects get --name gridcore --connection-string

# Set environment variable
vercel env add DATABASE_URL "postgresql://..." production
📦 Storage Setup
Vercel Blob Storage
bash
# Create blob storage
vercel blob create

# Get token
vercel blob list

# Set environment variable
vercel env add BLOB_READ_WRITE_TOKEN "token..." production
Alternative Storage Providers
bash
# Cloudflare R2
vercel env add R2_ACCESS_KEY_ID "..." production
vercel env add R2_SECRET_ACCESS_KEY "..." production
vercel env add R2_ENDPOINT "..." production
vercel env add R2_BUCKET_NAME "..." production

# AWS S3
vercel env add AWS_ACCESS_KEY_ID "..." production
vercel env add AWS_SECRET_ACCESS_KEY "..." production
vercel env add AWS_REGION "..." production
vercel env add AWS_BUCKET_NAME "..." production
🚀 Deployment Commands
Initial Deployment
bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Link project
vercel link

# 4. Deploy to preview
vercel

# 5. Deploy to production
vercel --prod
Continuous Deployment
bash
# Automatic deployments on push to main branch
# Configure in Vercel dashboard:
# - Git provider: GitHub/GitLab/Bitbucket
# - Branch: main
# - Framework: Next.js
# - Build Command: npm run build
# - Output Directory: .next
Manual Deployment
bash
# Build locally
npm run build

# Deploy to preview
vercel --prebuilt

# Deploy to production
vercel --prebuilt --prod
🔄 CI/CD Workflow
File: .github/workflows/deploy.yml
yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build application
        run: npm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
🔍 Monitoring & Logging
Vercel Analytics
typescript
// lib/analytics.ts
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export function useAnalytics() {
  const router = useRouter()

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // Send to Vercel Analytics
      if (typeof window !== 'undefined' && (window as any).va) {
        ;(window as any).va('event', {
          event: 'pageview',
          url,
        })
      }
    }

    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router])
}
Error Tracking (Sentry)
javascript
// next.config.js
const withSentry = require('@sentry/nextjs')

module.exports = withSentry({
  sentry: {
    hideSourceMaps: true,
  },
  // ... other config
})
Logging
typescript
// lib/logging.ts
export function logError(error: Error, context?: any) {
  console.error({
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    context,
    environment: process.env.NODE_ENV,
  })
}

export function logInfo(message: string, data?: any) {
  console.log({
    timestamp: new Date().toISOString(),
    message,
    data,
    environment: process.env.NODE_ENV,
  })
}
🧪 Testing in Production
Preview Deployment Testing
bash
# 1. Deploy preview
vercel

# 2. Run E2E tests against preview
npm run test:e2e -- --base-url=https://preview-url.vercel.app

# 3. Manual testing
# - Test all features
# - Check WebSocket connections
# - Verify database operations
# - Test file uploads
Production Testing Checklist
□ Authentication works (all providers)
□ WebSocket connections establish
□ Session creation and joining works
□ Real-time collaboration works
□ File operations work
□ Chat works
□ Import/Export works
□ Database connections are stable
□ Storage uploads/downloads work
□ Rate limiting is enforced
□ Error handling is working
□ Analytics are tracking
🚨 Rollback Procedure
Vercel Dashboard Rollback
bash
# 1. Go to Vercel dashboard
# 2. Select project
# 3. Go to Deployments
# 4. Find previous working deployment
# 5. Click "Promote to Production"
CLI Rollback
bash
# List deployments
vercel list

# Rollback to specific deployment
vercel rollback <deployment-id>

# Rollback to previous version
vercel rollback
📊 Performance Monitoring
Vercel Speed Insights
typescript
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
Custom Monitoring
typescript
// lib/monitoring.ts
export function trackPerformance(metric: {
  name: string
  value: number
  tags?: Record<string, string>
}) {
  if (typeof window !== 'undefined') {
    // Send to analytics
    if ((window as any).gtag) {
      ;(window as any).gtag('event', metric.name, {
        value: metric.value,
        ...metric.tags,
      })
    }
  }
}
📝 Deployment Checklist
□ Environment variables configured
□ Database created and migrated
□ Storage bucket created
□ OAuth credentials configured
□ WebSocket endpoint configured
□ SSL certificates enabled (auto by Vercel)
□ Custom domain configured (if needed)
□ Analytics enabled
□ Error tracking configured
□ Monitoring set up
□ Backup strategy in place
□ Rollback procedure documented
Next: Read 02-environment-setup.md for environment setup details.

```
