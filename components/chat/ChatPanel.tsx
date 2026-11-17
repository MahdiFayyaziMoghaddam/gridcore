'use client'

import { useChat } from '@/hooks/useChat'
import { CHAT_MAX_MESSAGE_LENGTH } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/stores/chatStore'

export function ChatPanel() {
  const { messages, error, sendMessage, isMuted, toggleMute, unreadCount } = useChat()

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-2 py-1">
        <span className="text-xs text-muted">
          {messages.length} message{messages.length === 1 ? '' : 's'}
          {unreadCount > 0 && ` · ${unreadCount} new`}
        </span>
        <Button variant="ghost" size="sm" onClick={toggleMute}>
          {isMuted ? 'Unmute' : 'Mute'}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        {messages.length === 0 && (
          <p className="py-4 text-xs text-muted">No messages yet. Say hello.</p>
        )}

        {messages.map(message => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </ScrollArea>

      <ChatInput onSend={sendMessage} disabled={isMuted} error={error} />
    </div>
  )
}

type Message = ReturnType<typeof useChatStore.getState>['messages'][number]

function ChatMessage({ message }: { message: Message }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium">{message.userName ?? 'Unknown'}</span>
        <time className="text-[10px] text-muted" dateTime={message.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </time>
      </div>
      <p
        className={
          'whitespace-pre-wrap break-words rounded px-2 py-1 text-sm ' +
          (message.isOwn ? 'bg-surface-hover text-text' : 'bg-surface text-text')
        }
      >
        {message.content}
      </p>
    </div>
  )
}

function ChatInput({
  onSend,
  disabled,
  error,
}: {
  onSend: (content: string) => void
  disabled: boolean
  error: string | null
}) {
  return (
    <form
      className="shrink-0 space-y-1 border-t border-border p-2"
      onSubmit={event => {
        event.preventDefault()
        const form = event.currentTarget
        const field = form.elements.namedItem('message') as HTMLInputElement
        if (field.value.trim()) {
          onSend(field.value)
          field.value = ''
        }
      }}
    >
      <div className="flex gap-1">
        <Input
          name="message"
          autoComplete="off"
          disabled={disabled}
          maxLength={CHAT_MAX_MESSAGE_LENGTH}
          placeholder={`Type a message (${CHAT_MAX_MESSAGE_LENGTH} char max)...`}
          aria-label="Chat message"
        />
        <Button type="submit" size="sm" disabled={disabled}>
          Send
        </Button>
      </div>

      {error && <p className="text-[11px] text-error">{error}</p>}
    </form>
  )
}