import { useEffect, useState } from 'react'

/** `#/g/<slug>` is the whole routing surface: the link is the agora. */
export function slugFromHash(hash: string): string | null {
  return /^#\/g\/([a-z0-9]{8})$/.exec(hash)?.[1] ?? null
}

export function openAgora(slug: string): void {
  window.location.hash = `#/g/${slug}`
}

/** Keeps the view in step with the address bar without pulling in a router. */
export function useHashSlug(): string | null {
  const [slug, setSlug] = useState(() => slugFromHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setSlug(slugFromHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return slug
}
