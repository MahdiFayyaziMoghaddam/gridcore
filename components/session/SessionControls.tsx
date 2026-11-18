'use client'

import { useRef, useState } from 'react'
import { Crown, Download, Key, LogOut, Save, Shield, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFileSystem } from '@/hooks/useFileSystem'
import { usePermissions } from '@/hooks/usePermissions'
import { useSessionActions } from '@/hooks/useSession'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useSessionStore } from '@/stores/sessionStore'
import { useUiStore } from '@/stores/uiStore'

export function SessionControls() {
  const permissions = usePermissions()
  const { importZip, exportZip } = useFileSystem()
  const { sessionId, send } = useWebSocket()
  const { grantOwnership, revokeOwnership, saveSession } = useSessionActions()

  const users = useSessionStore(state => state.users)
  const ownerId = useSessionStore(state => state.ownerId)
  const tempOwnerId = useSessionStore(state => state.tempOwnerId)
  const isSaving = useUiStore(state => state.isSaving)
  const isExporting = useUiStore(state => state.isExporting)
  const isImporting = useUiStore(state => state.isImporting)

  const [grantOpen, setGrantOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const eligible = Array.from(users.values()).filter(
    user => user.id !== ownerId && user.id !== tempOwnerId
  )

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInput}
        type="file"
        accept=".zip"
        className="hidden"
        aria-label="Import ZIP"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) void importZip(file)
          event.target.value = ''
        }}
      />

      <Button
        variant="outline"
        size="sm"
        disabled={!permissions.canImportFiles || isImporting}
        onClick={() => fileInput.current?.click()}
        title="Import codebase from a ZIP"
      >
        <Upload size={14} />
        Import
      </Button>

      {permissions.isOwner && (
        <>
          <Button
            variant="outline"
            size="sm"
            isLoading={isSaving}
            onClick={saveSession}
            title="Save session"
          >
            <Save size={14} />
            Save
          </Button>

          <Button
            variant="outline"
            size="sm"
            isLoading={isExporting}
            onClick={() => void exportZip(`${sessionId}.zip`)}
            title="Export codebase as a ZIP"
          >
            <Download size={14} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            title="Change session ID"
            onClick={() => {
              if (
                window.confirm(
                  'Changing the session ID will break all existing invite links. Continue?'
                )
              ) {
                send('session:id-change', { sessionId })
              }
            }}
          >
            <Key size={14} />
          </Button>
        </>
      )}

      {permissions.isOwner && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" title="Manage temporary ownership">
              <Shield size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {tempOwnerId ? (
              <>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-warning">
                  <Crown size={12} />
                  Temp Owner: {users.get(tempOwnerId)?.name ?? 'Unknown'}
                </div>
                <DropdownMenuItem
                  onClick={() => {
                    revokeOwnership()
                    setGrantOpen(false)
                  }}
                >
                  Revoke Temp Owner
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => setGrantOpen(true)}>
                Grant Temp Owner
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {permissions.isTempOwner && !permissions.isOwner && (
        <span className="flex items-center gap-1 rounded bg-warning/10 px-2 py-1 text-[10px] uppercase text-warning">
          <Crown size={12} /> Temp Owner
        </span>
      )}

      <Button
        variant="ghost"
        size="icon"
        title="Leave session"
        aria-label="Leave session"
        onClick={() => setLeaveOpen(true)}
      >
        <LogOut size={14} />
      </Button>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Temporary Ownership</DialogTitle>
          </DialogHeader>

          <p className="py-3 text-sm text-muted">
            They can create and delete files, and keep the session alive if you disconnect. They
            cannot save, export, or change the session ID.
          </p>

          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="Select a user..." />
            </SelectTrigger>
            <SelectContent>
              {eligible.length === 0 && (
                <SelectItem value="none" disabled>
                  No other users online
                </SelectItem>
              )}
              {eligible.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedUser}
              onClick={() => {
                grantOwnership(selectedUser)
                setGrantOpen(false)
                setSelectedUser('')
              }}
            >
              Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this session?</DialogTitle>
          </DialogHeader>

          <p className="py-3 text-sm text-muted">
            {permissions.isOwner
              ? 'Leaving hands the session to a temp owner if present, otherwise it closes for everyone.'
              : 'You will need the session ID to rejoin.'}
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              Stay
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLeaveOpen(false)
                // The owner leaving ends the session for everyone if no temp owner is online.
                send('leave', { sessionId })
              }}
            >
              <LogOut size={14} /> Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
