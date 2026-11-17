export interface ApiErrorBody {
  error: string
  code?: string
  details?: Record<string, unknown>
}

export interface UserResponse {
  id: string
  name: string
  email: string
  createdAt: string
}

export interface SessionLoadResponse {
  session: {
    id: string
    name: string
    ownerId: string
    zipUrl?: string | null
    createdAt: string
    updatedAt: string
  }
  zip: string
}