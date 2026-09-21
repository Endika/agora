import { useEffect, useState } from 'react'

/**
 * Every screen that can be left is a route, on purpose: writing a proposal, editing one and reading
 * one are all places you can link to, share, and — on a phone — leave with the back button instead
 * of hunting for a close button. The back button closing a sheet is the whole point of the union.
 */
export type Route =
  | { kind: 'home' }
  | { kind: 'privacy' }
  | { kind: 'board'; slug: string }
  | { kind: 'proposal'; slug: string; proposalId: string }
  | { kind: 'compose'; slug: string }
  | { kind: 'edit'; slug: string; proposalId: string }

const BOARD = /^#\/g\/([a-z0-9]{8})$/
const COMPOSE = /^#\/g\/([a-z0-9]{8})\/nueva$/
const PROPOSAL = /^#\/g\/([a-z0-9]{8})\/p\/([0-9a-f-]{36})$/
const EDIT = /^#\/g\/([a-z0-9]{8})\/p\/([0-9a-f-]{36})\/editar$/

/** Longest first: an edit address also matches the start of a proposal one. */
export function parseRoute(hash: string): Route {
  if (hash === '#/privacy') return { kind: 'privacy' }
  const edit = EDIT.exec(hash)
  if (edit) return { kind: 'edit', slug: edit[1]!, proposalId: edit[2]! }
  const proposal = PROPOSAL.exec(hash)
  if (proposal) return { kind: 'proposal', slug: proposal[1]!, proposalId: proposal[2]! }
  const compose = COMPOSE.exec(hash)
  if (compose) return { kind: 'compose', slug: compose[1]! }
  const board = BOARD.exec(hash)
  if (board) return { kind: 'board', slug: board[1]! }
  return { kind: 'home' }
}

export function boardHref(slug: string): string {
  return `#/g/${slug}`
}

export function proposalHref(slug: string, proposalId: string): string {
  return `#/g/${slug}/p/${proposalId}`
}

export function composeHref(slug: string): string {
  return `#/g/${slug}/nueva`
}

export function editHref(slug: string, proposalId: string): string {
  return `#/g/${slug}/p/${proposalId}/editar`
}

export function openAgora(slug: string): void {
  window.location.hash = boardHref(slug)
}

export function openCompose(slug: string): void {
  window.location.hash = composeHref(slug)
}

export function openEdit(slug: string, proposalId: string): void {
  window.location.hash = editHref(slug, proposalId)
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
