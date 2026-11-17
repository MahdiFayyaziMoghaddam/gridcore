/**
 * Deterministic per-user colors. No store, no state — pure hash of userId
 * into a fixed palette so every client agrees on who is who.
 */

const PALETTE = [
  '#58a6ff',
  '#3fb950',
  '#d29922',
  '#f85149',
  '#bc8cff',
  '#39c5cf',
  '#ff7b72',
  '#a5d6ff',
  '#7ee787',
  '#ffa657',
] as const

const CONTRAST_DARK = '#0d1117'
const CONTRAST_LIGHT = '#ffffff'

export function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0 // force int32
  }
  return PALETTE[Math.abs(hash) % PALETTE.length] ?? PALETTE[0]
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '')
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)))
  return `#${[r, g, b].map(n => clamp(n).toString(16).padStart(2, '0')).join('')}`
}

/** Relative luminance per WCAG 2.1. */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const channel = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function getContrastColor(background: string): string {
  return luminance(background) > 0.179 ? CONTRAST_DARK : CONTRAST_LIGHT
}

export function lightenColor(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex({ r: r + amount, g: g + amount, b: b + amount })
}

export function darkenColor(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex({ r: r - amount, g: g - amount, b: b - amount })
}