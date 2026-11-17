import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { SIDEBAR_DEFAULT_WIDTH } from '@/lib/constants'

export type SidebarTab = 'files' | 'chat' | 'users'

export interface Notification {
  id: string
  message: string
  tone: 'info' | 'success' | 'error'
  createdAt: number
}

interface UiStore {
  sidebarWidth: number
  isSidebarOpen: boolean
  activeSidebarTab: SidebarTab
  isSaving: boolean
  isImporting: boolean
  isExporting: boolean
  notifications: Notification[]

  setSidebarWidth: (width: number) => void
  toggleSidebar: () => void
  setSidebarOpen: (isOpen: boolean) => void
  setActiveTab: (tab: SidebarTab) => void
  setSaving: (isSaving: boolean) => void
  setImporting: (isImporting: boolean) => void
  setExporting: (isExporting: boolean) => void
  notify: (message: string, tone?: Notification['tone']) => void
  dismiss: (id: string) => void
}

export const useUiStore = create<UiStore>()(
  devtools(
    set => ({
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      isSidebarOpen: true,
      activeSidebarTab: 'files',
      isSaving: false,
      isImporting: false,
      isExporting: false,
      notifications: [],

      setSidebarWidth: sidebarWidth => set({ sidebarWidth }),

      toggleSidebar: () => set(prev => ({ isSidebarOpen: !prev.isSidebarOpen })),

      setSidebarOpen: isSidebarOpen => set({ isSidebarOpen }),

      setActiveTab: activeSidebarTab => set({ activeSidebarTab }),

      setSaving: isSaving => set({ isSaving }),
      setImporting: isImporting => set({ isImporting }),
      setExporting: isExporting => set({ isExporting }),

      notify: (message, tone = 'info') =>
        set(prev => ({
          notifications: [
            ...prev.notifications,
            { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, message, tone, createdAt: Date.now() },
          ].slice(-5),
        })),

      dismiss: id =>
        set(prev => ({ notifications: prev.notifications.filter(n => n.id !== id) })),
    }),
    { name: 'ui-store' }
  )
)