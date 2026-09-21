import { describe, it, expect } from 'vitest'
import {
  composeHref,
  editHref,
  parseRoute,
  proposalHref,
  openAgora,
  openCompose,
  openEdit,
} from '@/presentation/routing'

const SLUG = 'demoag01'
const ID = '018f4b2c-0000-7000-8000-000000000001'

describe('parseRoute', () => {
  it('reconoce las seis rutas', () => {
    expect(parseRoute('')).toEqual({ kind: 'home' })
    expect(parseRoute('#/privacy')).toEqual({ kind: 'privacy' })
    expect(parseRoute(`#/g/${SLUG}`)).toEqual({ kind: 'board', slug: SLUG })
    expect(parseRoute(`#/g/${SLUG}/nueva`)).toEqual({ kind: 'compose', slug: SLUG })
    expect(parseRoute(`#/g/${SLUG}/p/${ID}`)).toEqual({
      kind: 'proposal',
      slug: SLUG,
      proposalId: ID,
    })
    expect(parseRoute(`#/g/${SLUG}/p/${ID}/editar`)).toEqual({
      kind: 'edit',
      slug: SLUG,
      proposalId: ID,
    })
  })

  it('cae a home ante basura', () => {
    expect(parseRoute('#/g/NOPE')).toEqual({ kind: 'home' })
    expect(parseRoute(`#/g/${SLUG}/p/nope`)).toEqual({ kind: 'home' })
    expect(parseRoute(`#/g/${SLUG}/nueva/nueva`)).toEqual({ kind: 'home' })
  })
})

describe('las direcciones y la barra del navegador', () => {
  it('cada open deja una dirección que vuelve a parsearse igual', () => {
    openAgora(SLUG)
    expect(parseRoute(window.location.hash)).toEqual({ kind: 'board', slug: SLUG })

    openCompose(SLUG)
    expect(window.location.hash).toBe(composeHref(SLUG))
    expect(parseRoute(window.location.hash)).toEqual({ kind: 'compose', slug: SLUG })

    openEdit(SLUG, ID)
    expect(window.location.hash).toBe(editHref(SLUG, ID))
    expect(parseRoute(window.location.hash)).toEqual({ kind: 'edit', slug: SLUG, proposalId: ID })
  })

  it('el enlace a una propuesta es la ruta de esa propuesta', () => {
    expect(parseRoute(proposalHref(SLUG, ID))).toEqual({
      kind: 'proposal',
      slug: SLUG,
      proposalId: ID,
    })
  })
})
