# GridCore - REST API Endpoints

## 📋 Overview

This document defines all REST API endpoints used in GridCore. These endpoints handle authentication, session management, user data, and storage operations. All endpoints (except auth) require authentication via NextAuth.js JWT tokens.

---

## 🏗️ API Structure

```text
/api
├── auth/ # Authentication
│ └── [...nextauth]/ # NextAuth.js handlers
├── websocket/ # WebSocket endpoint
├── sessions/ # Session management
│ ├── [id]/ # Single session operations
│ │ ├── save/ # Save session
│ │ └── export/ # Export session (future)
│ ├── check/[id]/ # Check session availability
│ └── join/[id]/ # Join session (future)
└── users/
└── me/ # Current user info
```

---

## 🔐 Authentication Endpoints

### POST `/api/auth/register`

Register a new user.

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
**Response (201 Created):**

```json
{
  "success": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Response (400 Bad Request):**

```json
{
  "error": "Invalid email address"
}
```

**Response (409 Conflict):**

```json
{
  "error": "Email already registered"
}
```

### POST `/api/auth/login`

Login with email and password. This is handled by NextAuth.js.

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**

```json
{
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### GET `/api/auth/session`

Get current session information.

**Response (200 OK):**

```json
{
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "expires": "2024-01-01T00:00:00.000Z"
}
```

**Response (401 Unauthorized):**

```json
{
  "error": "Unauthorized"
}
```

## 📚 Session Endpoints

### GET `/api/sessions`

List all saved sessions for the authenticated user.

**Response (200 OK):**

```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "My Project",
    "ownerId": "user-123",
    "zipUrl": "https://blob.example.com/sessions/123/codebase.zip",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
```
  },
  {
    "id": "223e4567-e89b-12d3-a456-426614174001",
    "name": "Another Project",
    "ownerId": "user-123",
    "zipUrl": "https://blob.example.com/sessions/223/codebase.zip",
    "createdAt": "2024-01-02T00:00:00.000Z",
    "updatedAt": "2024-01-02T12:00:00.000Z"
  }
]
POST /api/sessions
Create a new session.

Request Body:

json
{
  "name": "My New Project" // Optional
}
Response (201 Created):

json
{
  "sessionId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "My New Project",
  "ownerId": "user-123",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
Response (403 Forbidden):

json
{
  "error": "Maximum 3 saved sessions allowed"
}
GET /api/sessions/[id]
Load a saved session.

Parameters:

id: Session ID (UUID)

Response (200 OK):

json
{
  "session": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "My Project",
    "ownerId": "user-123",
    "zipUrl": "https://blob.example.com/sessions/123/codebase.zip",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  },
  "zip": "UEsDBAoAAAAA..." // base64 encoded ZIP
}
Response (404 Not Found):

json
{
  "error": "Session not found"
}
Response (401 Unauthorized):

json
{
  "error": "Unauthorized"
}
DELETE /api/sessions/[id]
Delete a saved session.

Parameters:

id: Session ID (UUID)

Response (200 OK):

json
{
  "success": true
}
Response (404 Not Found):

json
{
  "error": "Session not found"
}
Response (401 Unauthorized):

json
{
  "error": "Unauthorized"
}
Response (409 Conflict):

json
{
  "error": "Cannot delete active session"
}
POST /api/sessions/[id]/save
Save a session to storage.

Parameters:

id: Session ID (UUID)

Request Body:

json
{
  "zip": "UEsDBAoAAAAA...", // base64 encoded ZIP
  "name": "Updated Project Name" // Optional
}
Response (200 OK):

json
{
  "success": true,
  "zipUrl": "https://blob.example.com/sessions/123/codebase.zip"
}
Response (403 Forbidden):

json
{
  "error": "Maximum 3 saved sessions allowed"
}
Response (413 Payload Too Large):

json
{
  "error": "File exceeds 50MB limit"
}
GET /api/sessions/check/[id]
Check if a session exists and is active.

Parameters:

id: Session ID (UUID)

Response (200 OK):

json
{
  "exists": true,
  "isActive": true,
  "userCount": 5,
  "maxUsers": 20,
  "isSaved": true
}
Response (200 OK - Inactive):

json
{
  "exists": true,
  "isActive": false,
  "reason": "No owner online"
}
Response (200 OK - Not Found):

json
{
  "exists": false
}
👤 User Endpoints
GET /api/users/me
Get current user information.

Response (200 OK):

json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
Response (401 Unauthorized):

json
{
  "error": "Unauthorized"
}
PUT /api/users/me
Update current user information.

Request Body:

json
{
  "name": "John Smith" // Optional
}
Response (200 OK):

json
{
  "success": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "John Smith",
    "email": "john@example.com"
  }
}
DELETE /api/users/me
Delete current user account.

Response (200 OK):

json
{
  "success": true
}
📊 Response Codes
Code	Description
200	Success
201	Created
400	Bad Request
401	Unauthorized
403	Forbidden
404	Not Found
409	Conflict
413	Payload Too Large
429	Too Many Requests
500	Internal Server Error
🛡️ Headers
Authentication
http
Authorization: Bearer <jwt-token>
Cookie: next-auth.session-token=<jwt-token>
Content Type
http
Content-Type: application/json
Rate Limiting
http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1700000000
📝 Request/Response Examples
Create Session (cURL)
bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=eyJ..." \
  -d '{"name": "My Project"}'
Get Sessions (cURL)
bash
curl -X GET http://localhost:3000/api/sessions \
  -H "Cookie: next-auth.session-token=eyJ..."
Save Session (cURL)
bash
curl -X POST http://localhost:3000/api/sessions/123/save \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=eyJ..." \
  -d '{"zip": "UEsDBAoAAAAA..."}'
Check Session (cURL)
bash
curl -X GET http://localhost:3000/api/sessions/check/123
🔒 Error Handling
Error Response Format
json
{
  "error": "Human readable error message",
  "code": "ERROR_CODE", // Optional
  "details": {} // Optional additional data
}
Common Errors
typescript
// lib/api/errors.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message)
  }
}

export const ApiErrors = {
  Unauthorized: new ApiError(401, 'Unauthorized', 'UNAUTHORIZED'),
  Forbidden: new ApiError(403, 'Forbidden', 'FORBIDDEN'),
  NotFound: (resource: string) => new ApiError(404, `${resource} not found`, 'NOT_FOUND'),
  Conflict: (message: string) => new ApiError(409, message, 'CONFLICT'),
  RateLimit: new ApiError(429, 'Rate limit exceeded', 'RATE_LIMIT_EXCEEDED'),
  Validation: (errors: any) => new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors })
}
📚 API Middleware
File: lib/api/middleware.ts
typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { rateLimit } from '@/lib/rate-limit'
import { ApiError } from './errors'

export async function withAuth(
  req: NextRequest,
  handler: (req: NextRequest, session: any) => Promise<NextResponse>
) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return handler(req, session)
}

export async function withRateLimit(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  const result = await rateLimit(req)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 429 }
    )
  }

  return handler(req)
}

export async function withErrorHandler(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  try {
    return await handler(req)
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.statusCode }
      )
    }

    console.error('Unhandled error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
📝 API Usage Examples
Client-Side Fetch
typescript
// lib/api/client.ts
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'API request failed')
  }

  return response.json()
}

// Usage
const sessions = await apiFetch<Session[]>('/sessions')
const newSession = await apiFetch<{ sessionId: string }>('/sessions', {
  method: 'POST',
  body: JSON.stringify({ name: 'My Project' })
})

Next: Read 03-types.md for TypeScript type definitions.
```
