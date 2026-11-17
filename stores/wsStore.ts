import { create } from 'zustand'

interface WebSocketStore {
  isConnected: boolean
  isConnecting: boolean
  lastError: string | null

  setConnecting: () => void
  setConnected: () => void
  setDisconnected: () => void
  setError: (message: string) => void
  clearError: () => void
}

/** Connection lifecycle is its own domain — kept out of uiStore on purpose. */
export const useWebSocketStore = create<WebSocketStore>()(set => ({
  isConnected: false,
  isConnecting: false,
  lastError: null,

  setConnecting: () => set({ isConnecting: true, lastError: null }),
  setConnected: () => set({ isConnected: true, isConnecting: false, lastError: null }),
  setDisconnected: () => set({ isConnected: false, isConnecting: false }),
  setError: lastError => set({ lastError, isConnecting: false, isConnected: false }),
  clearError: () => set({ lastError: null }),
}))