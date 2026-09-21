import { useEffect, useState } from 'react'

/**
 * Every screen that can be left is a route, on purpose: writing a proposal, editing one and reading
 * one are all places you can link to, share, and — on a phone — leave with the back button instead
 * of hunting for a close button. The back button closing a sheet is the whole point of the union.
 */
export type Route =
  | { kind: 'home' }
  /** The slug is what lets the notice say which ballot mode the reader is actually under. */
  | { kind: 'privacy'; slug: string | null }
  | { kind: 'board'; slug: string }
  | { kind: 'proposal'; slug: string; proposalId: string }
  | { kind: 'compose'; slug: string }
  | { kind: 'edit'; slug: string; proposalId: string }

const BOARD = /^#\/g\/([a-z0-9]{8})$/
const PRIVACY = /^#\/g\/([a-z0-9]{8})\/privacidad$/
const COMPOSE = /^#\/g\/([a-z0-9]{8})\/nueva$/
const PROPOSAL = /^#\/g\/([a-z0-9]{8})\/p\/([0-9a-f-]{36})$/
const EDIT = /^#\/g\/([a-z0-9]{8})\/p\/([0-9a-f-]{36})\/editar$/

export function parseRoute(hash: string): Route {
  if (hash === '#/privacy') return { kind: 'privacy', slug: null }
  const privacy = PRIVACY.exec(hash)
  if (privacy) return { kind: 'privacy', slug: privacy[1]! }
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

/**
 * Read from inside an agora, the privacy notice is about *that* agora: the ballot mode is half of
 * "who can see this", and the two agoras answer it in opposite ways. Read from the home screen
 * there is no agora yet, and the notice says so rather than picking one of the two answers.
 */
export function privacyHref(slug: string | null): string {
  return slug ? `#/g/${slug}/privacidad` : '#/privacy'
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

/**
 * Leaving a sheet replaces the address instead of pushing one. Opening the sheet is the step the
 * back button undoes; closing it must not add a second step that walks straight back in.
 * `history.replaceState` would not do: it fires no `hashchange`, so the view would never hear it.
 */
export function closeTo(href: string): void {
  window.location.replace(href)
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
