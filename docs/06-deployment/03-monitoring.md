# GridCore - Monitoring & Logging

## 📋 Overview

This document covers monitoring, logging, and observability for GridCore in production. It includes error tracking, performance monitoring, log management, and alerting.

---

## 🏗️ Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Monitoring Architecture │
├─────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Application │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Next.js │ │ WebSocket │ │ Database │ │ │
│ │ │ App │ │ Server │ │ PostgreSQL │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Logging & Metrics │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Vercel │ │ Sentry │ │ Custom │ │ │
│ │ │ Logs │ │ Errors │ │ Metrics │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Alerting & Notifications │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ Email │ │ Slack │ │ Dashboard │ │ │
│ │ │ Alerts │ │ Alerts │ │ (Custom) │ │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────┘
```

---
```

## 📊 Vercel Monitoring

### Vercel Analytics

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
Vercel Logs
bash
# View production logs
vercel logs --prod

# View recent logs
vercel logs --tail

# Filter by deployment
vercel logs --deployment <deployment-id>

# View logs with JSON format
vercel logs --format json
Vercel Metrics Dashboard
typescript
// lib/vercel-metrics.ts
export function trackVercelEvent(event: string, data?: any) {
  if (typeof window !== 'undefined' && (window as any).va) {
    ;(window as any).va('event', {
      event,
      data,
    })
  }
}
🐛 Error Tracking (Sentry)
Sentry Configuration
typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Integrations
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: false,
      blockAllMedia: true,
    }),
  ],
})
typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
Custom Error Tracking
typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs'

export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
    tags: {
      environment: process.env.NODE_ENV,
    },
  })
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level)
}

export function setUser(user: { id: string; email: string; name: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  })
}

export function setContext(name: string, context: Record<string, any>) {
  Sentry.setContext(name, context)
}
📝 Logging System
Structured Logging
typescript
// lib/logger.ts
import { Logtail } from '@logtail/node'
import { Logtail as LogtailBrowser } from '@logtail/browser'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  data?: any
  timestamp: string
  environment: string
  service: string
  sessionId?: string
  userId?: string
}

class Logger {
  private logtail: any
  private isBrowser: boolean

  constructor() {
    this.isBrowser = typeof window !== 'undefined'

    if (this.isBrowser) {
      this.logtail = new LogtailBrowser(process.env.NEXT_PUBLIC_LOGTAIL_TOKEN)
    } else {
      this.logtail = new Logtail(process.env.LOGTAIL_TOKEN)
    }
  }

  private log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      service: 'gridcore',
    }

    // Console output
    const consoleMethod = console[level] || console.log
    consoleMethod(`[${level.toUpperCase()}] ${message}`, data)

    // Send to Logtail
    this.logtail[level](message, data)
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data)
  }

  info(message: string, data?: any) {
    this.log('info', message, data)
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data)
  }

  error(message: string, error?: any, data?: any) {
    this.log('error', message, { error, data })

    // Also capture in Sentry
    if (error instanceof Error) {
      captureError(error, data)
    }
  }
}

export const logger = new Logger()
HTTP Request Logging
typescript
// lib/logging-middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { logger } from './logger'

export function withLogging(handler: Function) {
  return async (req: NextRequest) => {
    const start = Date.now()
    const method = req.method
    const path = req.nextUrl.pathname
    const ip = req.ip || 'unknown'

    try {
      const response = await handler(req)
      const duration = Date.now() - start

      logger.info(`HTTP ${method} ${path}`, {
        status: response.status,
        duration,
        ip,
        userAgent: req.headers.get('user-agent'),
      })

      return response
    } catch (error) {
      const duration = Date.now() - start
      logger.error(`HTTP ${method} ${path} failed`, error, {
        duration,
        ip,
        userAgent: req.headers.get('user-agent'),
      })
      throw error
    }
  }
}
📊 Custom Metrics
Performance Metrics
typescript
// lib/metrics.ts
class MetricsCollector {
  private metrics: Map<string, number[]> = new Map()

  // Record a metric value
  record(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(value)

    // Keep last 1000 values
    const values = this.metrics.get(name)!
    if (values.length > 1000) {
      values.shift()
    }
  }

  // Get metric statistics
  getStats(name: string) {
    const values = this.metrics.get(name)
    if (!values || values.length === 0) {
      return null
    }

    const sorted = [...values].sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    }
  }

  // Get all metrics
  getAllMetrics() {
    const result: Record<string, any> = {}
    for (const [name] of this.metrics) {
      result[name] = this.getStats(name)
    }
    return result
  }
}

export const metrics = new MetricsCollector()
Tracking Specific Operations
typescript
// lib/performance.ts
import { metrics } from './metrics'

export function trackPerformance(name: string, fn: () => Promise<any>) {
  return async () => {
    const start = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - start
      metrics.record(`${name}.duration`, duration)
      metrics.record(`${name}.success`, 1)
      return result
    } catch (error) {
      const duration = performance.now() - start
      metrics.record(`${name}.duration`, duration)
      metrics.record(`${name}.error`, 1)
      throw error
    }
  }
}

export function trackTime(name: string) {
  const start = performance.now()
  return {
    end: () => {
      const duration = performance.now() - start
      metrics.record(name, duration)
      return duration
    },
  }
}
🚨 Alerting
Alert Configuration
typescript
// lib/alerts.ts
interface AlertRule {
  name: string
  condition: (metrics: any) => boolean
  severity: 'info' | 'warning' | 'critical'
  message: string
}

const alertRules: AlertRule[] = [
  {
    name: 'high_error_rate',
    condition: (metrics) => {
      const errors = metrics.getStats('error.count')
      return errors && errors.count > 10
    },
    severity: 'critical',
    message: 'High error rate detected',
  },
  {
    name: 'slow_response_time',
    condition: (metrics) => {
      const responseTime = metrics.getStats('api.response_time')
      return responseTime && responseTime.p95 > 1000
    },
    severity: 'warning',
    message: 'Slow API response times',
  },
  {
    name: 'high_cpu_usage',
    condition: (metrics) => {
      const cpu = metrics.getStats('system.cpu')
      return cpu && cpu.avg > 80
    },
    severity: 'warning',
    message: 'High CPU usage',
  },
  {
    name: 'memory_high',
    condition: (metrics) => {
      const memory = metrics.getStats('system.memory')
      return memory && memory.avg > 80
    },
    severity: 'critical',
    message: 'High memory usage',
  },
]
Alert Sending
typescript
// lib/alerts-sender.ts
import { logger } from './logger'

export async function sendAlert(rule: AlertRule, data: any) {
  const message = `[${rule.severity.toUpperCase()}] ${rule.message}`

  // Log alert
  logger.warn('Alert triggered', {
    rule: rule.name,
    severity: rule.severity,
    data,
  })

  // Send to Slack (if configured)
  if (process.env.SLACK_WEBHOOK_URL) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        attachments: [
          {
            color: rule.severity === 'critical' ? 'danger' : 'warning',
            fields: [
              {
                title: 'Rule',
                value: rule.name,
                short: true,
              },
              {
                title: 'Severity',
                value: rule.severity,
                short: true,
              },
              {
                title: 'Data',
                value: JSON.stringify(data, null, 2),
              },
            ],
          },
        ],
      }),
    })
  }
}
📊 Dashboard
Custom Status Dashboard
typescript
// app/api/status/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { state } from '@/lib/websocket/state'

export async function GET() {
  // Check database
  let databaseStatus = 'healthy'
  try {
    await db.execute(sql`SELECT 1`)
  } catch {
    databaseStatus = 'unhealthy'
  }

  // Check WebSocket
  const websocketStatus = {
    connections: state.connections.size,
    sessions: state.sessions.size,
  }

  // Check storage
  let storageStatus = 'healthy'
  try {
    // Test blob storage
    const { list } = await import('@vercel/blob')
    await list({ limit: 1 })
  } catch {
    storageStatus = 'unhealthy'
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: databaseStatus,
      websocket: websocketStatus,
      storage: storageStatus,
    },
    metrics: {
      activeUsers: state.connections.size,
      activeSessions: state.sessions.size,
      totalSessions: state.sessions.size,
    },
  })
}
Health Check
typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ status: 'healthy' })
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: String(error) },
      { status: 500 }
    )
  }
}
📈 Metrics Dashboard
Grafana Configuration (Optional)
json
{
  "dashboard": {
    "title": "GridCore Monitoring",
    "panels": [
      {
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "query": "sum(active_users)"
          }
        ]
      },
      {
        "title": "Active Sessions",
        "type": "stat",
        "targets": [
          {
            "query": "sum(active_sessions)"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "query": "sum(errors) / sum(requests) * 100"
          }
        ]
      },
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "query": "p95(api_response_time)"
          }
        ]
      }
    ]
  }
}
🔍 Log Analysis
Log Query Examples
sql
-- PostgreSQL log analysis
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as requests,
  COUNT(DISTINCT user_id) as users,
  AVG(duration) as avg_duration
FROM app_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
Common Log Queries
bash
# Find errors in logs
vercel logs --prod | grep ERROR

# Find slow requests
vercel logs --prod | grep "duration>"

# Find specific user logs
vercel logs --prod | grep "userId:123"

# Count errors by type
vercel logs --prod | grep ERROR | cut -d' ' -f5 | sort | uniq -c
🧪 Monitoring Checklist
□ Vercel Analytics enabled
□ Speed Insights enabled
□ Sentry error tracking configured
□ Structured logging implemented
□ Performance metrics tracked
□ Alerting configured
□ Health check endpoint
□ Status dashboard
□ Log aggregation set up
□ Error tracking in place
□ Performance monitoring
□ Resource monitoring
□ Custom metrics tracked
□ Alert rules defined
□ Notification channels configured
Next: Proceed to 07-ui/01-layout.md for UI layout documentation.

```
