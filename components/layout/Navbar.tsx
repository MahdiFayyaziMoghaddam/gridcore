import { NAVBAR_HEIGHT } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function Navbar({ children }: { children?: React.ReactNode }) {
  return (
    <header
      className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-3"
      style={{ height: NAVBAR_HEIGHT }}
    >
      {children}
    </header>
  )
}

export function NavbarLogo() {
  return (
    <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
      <span className="inline-block h-3 w-3 rounded-sm bg-accent" aria-hidden />
      GridCore
    </span>
  )
}

export function NavbarSection({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />
}