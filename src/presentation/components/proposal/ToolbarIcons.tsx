/**
 * Inline SVGs for the Markdown toolbar. The self-hosted fonts only cover Latin-1, so glyphs like
 * 🔗 or ❝ fall through to whatever the platform has — tofu in Chromium. These are drawn, not typed,
 * so every viewer sees the same shape. The accessible name still comes from the button's own
 * aria-label; these are decorative.
 */
const shared = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

export function HeadingIcon() {
  return (
    <svg {...shared}>
      <path d="M6 4v16M18 4v16M6 12h12" />
    </svg>
  )
}

export function BoldIcon() {
  return (
    <svg {...shared}>
      <path d="M6 4h8a4 4 0 0 1 0 8H6z" />
      <path d="M6 12h9a4 4 0 0 1 0 8H6z" />
    </svg>
  )
}

export function ItalicIcon() {
  return (
    <svg {...shared}>
      <path d="M19 4h-9M14 20H5M15 4 9 20" />
    </svg>
  )
}

export function ListIcon() {
  return (
    <svg {...shared}>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function QuoteIcon() {
  return (
    <svg {...shared}>
      <path d="M7 7h4v4c0 3-2 5-4 5" />
      <path d="M15 7h4v4c0 3-2 5-4 5" />
    </svg>
  )
}

export function LinkIcon() {
  return (
    <svg {...shared}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
