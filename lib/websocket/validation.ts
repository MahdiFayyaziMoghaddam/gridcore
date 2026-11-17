import { z } from 'zod'
import { CHAT_MAX_MESSAGE_LENGTH } from '@/lib/constants'

const sessionId = z.string().uuid()

/** Mirrors ClientEventPayloads in types/websocket.ts. Every inbound event is validated. */
export const JoinSchema = z.object({ sessionId })

export const LeaveSchema = z.object({ sessionId })

export const CloseSessionSchema = z.object({
  sessionId,
  save: z.boolean().optional(),
})

export const SaveSessionSchema = z.object({ sessionId })

export const ChangeSessionIdSchema = z.object({
  sessionId,
  newSessionId: sessionId.optional(),
})

export const DiffSchema = z.object({
  sessionId,
  filePath: z.string().min(1),
  diff: z.unknown(),
})

export const CursorSchema = z.object({
  sessionId,
  filePath: z.string().min(1),
  position: z.object({
    line: z.number().int().min(0),
    column: z.number().int().min(0),
  }),
})

export const StatusSchema = z.object({
  sessionId,
  filePath: z.string().min(1),
  status: z.enum(['idle', 'editing', 'viewing']),
})

export const ChatSchema = z.object({
  sessionId,
  content: z.string().min(1).max(CHAT_MAX_MESSAGE_LENGTH),
})

export const FileCreateSchema = z.object({
  sessionId,
  path: z.string().min(1),
  content: z.string().optional(),
})

export const FileDeleteSchema = z.object({
  sessionId,
  path: z.string().min(1),
})

export const FileRenameSchema = z.object({
  sessionId,
  oldPath: z.string().min(1),
  newPath: z.string().min(1),
})

export const GrantOwnerSchema = z.object({
  sessionId,
  userId: z.string().uuid(),
})

export const RevokeOwnerSchema = z.object({ sessionId })

/**
 * Carries a full base64 ZIP plus an optional yjs state update, so it gets an
 * explicit upper bound rather than the generic 1MB WS message ceiling.
 */
export const SendZipSchema = z.object({
  targetUserId: z.string().min(1),
  zip: z.string().min(1),
  state: z.string().min(1).optional(),
})

export const inboundSchemas = {
  join: JoinSchema,
  leave: LeaveSchema,
  'session:close': CloseSessionSchema,
  'session:save': SaveSessionSchema,
  'session:id-change': ChangeSessionIdSchema,
  diff: DiffSchema,
  cursor: CursorSchema,
  status: StatusSchema,
  chat: ChatSchema,
  'file:create': FileCreateSchema,
  'file:delete': FileDeleteSchema,
  'file:rename': FileRenameSchema,
  'ownership:grant': GrantOwnerSchema,
  'ownership:revoke': RevokeOwnerSchema,
  'send:zip': SendZipSchema,
} as const

export type InboundEventType = keyof typeof inboundSchemas

export function hasSchema(type: string): type is InboundEventType {
  return type in inboundSchemas
}