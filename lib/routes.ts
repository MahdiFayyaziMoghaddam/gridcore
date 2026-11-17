/** Route map. Server-safe — no hooks, so any component may import it. */
export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  sessions: '/sessions',
  session: (id: string): string => `/session/${id}`,
  newSession: '/session/new',
  joinSession: '/session/join',
} as const

export const PUBLIC_PATHS = [
  ROUTES.login,
  ROUTES.register,
  '/api/auth',
  '/_next',
  '/favicon.ico',
] as const
