import * as Y from 'yjs'
import { getDoc } from '@/lib/collaboration/yjs'
import { getUserColor } from '@/lib/colors'
import type { ActivityStatus } from '@/lib/constants'

/**
 * Awareness rides alongside yjs but travels over GridCore's own WS protocol,
 * not y-websocket — there is no yjs server here.
 */

export interface LocalAwareness {
  user: { id: string; name: string }
  cursor: { filePath: string; line: number; column: number } | null
  status: ActivityStatus | null
}

export interface AwarenessState {
  users: Map<string, LocalAwareness>
  localId: string
}

export function createAwarenessState(localId: string): AwarenessState {
  return { users: new Map(), localId }
}

export function setLocalUser(
  state: AwarenessState,
  user: { id: string; name: string }
): void {
  const existing = state.users.get(user.id)
  state.users.set(user.id, {
    user,
    cursor: existing?.cursor ?? null,
    status: existing?.status ?? null,
  })
}

export function removeAwarenessUser(state: AwarenessState, userId: string): void {
  state.users.delete(userId)
}

export function setLocalCursor(
  state: AwarenessState,
  userId: string,
  cursor: { filePath: string; line: number; column: number } | null
): void {
  const entry = state.users.get(userId)
  if (entry) entry.cursor = cursor
}

export function setLocalStatus(
  state: AwarenessState,
  userId: string,
  status: ActivityStatus | null
): void {
  const entry = state.users.get(userId)
  if (entry) entry.status = status
}

export function getOtherUsers(state: AwarenessState): LocalAwareness[] {
  return Array.from(state.users.values()).filter(entry => entry.user.id !== state.localId)
}

export function colorForUser(userId: string): string {
  return getUserColor(userId)
}

export { Y, getDoc }