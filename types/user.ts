export interface User {
  id: string
  name: string
  email: string
  image?: string | null
}

export interface CursorPosition {
  line: number
  column: number
}

export interface RemoteCursor extends CursorPosition {
  filePath: string
  color: string
  userName: string
}

export interface Selection {
  filePath: string
  start: CursorPosition
  end: CursorPosition
}