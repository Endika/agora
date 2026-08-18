/**
 * The wordmark's companion: the same three columns as the app icon, but drawn freehand — uneven
 * shafts, slightly crooked capitals and a wobbly stylobate. Decorative, so it is hidden from
 * assistive tech: the heading next to it already says Agora.
 *
 * The launcher icon stays geometric on purpose; this much wobble turns to mud at 32 px.
 */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="var(--brand)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* shafts: each one leans a little differently, the way a hand draws three of anything */}
      <path d="M13.6 16.4c-.6 7.4-.8 14.8-.5 22.4" />
      <path d="M24.3 8.6c-.5 10.1-.6 20.3-.3 30.2" />
      <path d="M34.9 13.2c.6 8.6.7 17.2.4 25.6" />
      {/* capitals: narrower than the shafts are tall, or the whole thing reads as a T */}
      <path d="M10.8 15.4c1.9-.5 3.8-.6 5.7-.3" />
      <path d="M21.5 7.6c1.9-.4 3.8-.5 5.7-.2" />
      <path d="M32.1 12.2c1.9-.4 3.8-.4 5.6-.1" />
      {/* stylobate: two strokes, neither of them straight */}
      <path d="M7.4 39.2c11.2-1.1 22.5-1.2 33.7-.3" />
      <path d="M9.1 43c10.2-.9 20.5-1 30.7-.2" />
    </svg>
  )
}
