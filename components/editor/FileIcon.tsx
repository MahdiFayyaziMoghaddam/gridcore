import type { FileNode } from '@/types/file'
import { cn } from '@/lib/utils'

const ICON_COLORS: Record<string, string> = {
  ts: 'text-accent',
  tsx: 'text-accent',
  js: 'text-warning',
  jsx: 'text-warning',
  json: 'text-warning',
  css: 'text-accent',
  html: 'text-warning',
  md: 'text-text',
  py: 'text-success',
  go: 'text-accent',
  rs: 'text-warning',
}

export function FileIcon({ node }: { node: FileNode }) {
  if (node.type === 'folder') {
    return (
      <span className="w-4 shrink-0 text-warning" aria-hidden>
        ▸
      </span>
    )
  }

  const extension = node.extension ?? ''
  const color = ICON_COLORS[extension] ?? 'text-muted'

  return (
    <span className={cn('w-4 shrink-0 font-mono text-[10px] uppercase', color)} aria-hidden>
      {(extension || '·').slice(0, 2)}
    </span>
  )
}