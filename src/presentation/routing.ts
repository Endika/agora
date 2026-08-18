import { useEffect, useState } from 'react'

export interface Route {
  slug: string | null
  proposalId: string | null
}

const AGORA = /^#\/g\/([a-z0-9]{8})$/
const PROPOSAL = /^#\/g\/([a-z0-9]{8})\/p\/([0-9a-f-]{36})$/

/**
 * Two routes, and the proposal is one of them on purpose: opening a proposal is a place you can link to,
 * share, and — on a phone — leave with the back button instead of hunting for a close button.
 */
export function parseRoute(hash: string): Route {
  const proposal = PROPOSAL.exec(hash)
  if (proposal) return { slug: proposal[1]!, proposalId: proposal[2]! }
  const agora = AGORA.exec(hash)
  if (agora) return { slug: agora[1]!, proposalId: null }
  return { slug: null, proposalId: null }
}

export function openAgora(slug: string): void {
  window.location.hash = `#/g/${slug}`
}

export function openProposal(slug: string, proposalId: string): void {
  window.location.hash = `#/g/${slug}/p/${proposalId}`
}

export function proposalHref(slug: string, proposalId: string): string {
  return `#/g/${slug}/p/${proposalId}`
}

/** Keeps the view in step with the address bar without pulling in a router. */
export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
