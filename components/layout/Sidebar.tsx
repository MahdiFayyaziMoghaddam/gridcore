'use client'

import { Files, MessageSquare, Users } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SIDEBAR_DEFAULT_WIDTH, STATUSBAR_HEIGHT } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useUiStore, type SidebarTab } from '@/stores/uiStore'

const TABS: { id: SidebarTab; label: string; icon: typeof Files }[] = [
  { id: 'files', label: 'Files', icon: Files },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'users', label: 'Users', icon: Users },
]

export function Sidebar({ children }: { children?: React.ReactNode }) {
  const activeTab = useUiStore(state => state.activeSidebarTab)
  const setActiveTab = useUiStore(state => state.setActiveTab)
  const width = useUiStore(state => state.sidebarWidth)

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-border bg-surface"
      style={{ width }}
      aria-label="Sidebar"
    >
      <div role="tablist" className="flex shrink-0 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs transition-colors',
              activeTab === id ? 'text-accent' : 'text-muted hover:text-text'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">{children}</ScrollArea>

      <div className="shrink-0 border-t border-border" style={{ height: STATUSBAR_HEIGHT }} />
    </aside>
  )
}

export { SIDEBAR_DEFAULT_WIDTH }