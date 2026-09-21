import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { App } from '@/App'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { FakeOnlineDetector } from '@/infrastructure/network/OnlineDetector'
import { InMemoryActionQueue } from '@/infrastructure/sync/IdbActionQueue'
import type { VisitedAgorasStore } from '@/domain/ports/VisitedAgorasStore'
import {
  InMemoryProposalImages,
  InMemoryVisitedAgoras,
} from './presentation/support/renderWithBoard'

beforeEach(() => {
  window.location.hash = ''
  localStorage.clear()
})

const wiring = (visited: VisitedAgorasStore = new InMemoryVisitedAgoras()) => ({
  repo: new InMemoryBoardRepository(),
  visited,
  images: new InMemoryProposalImages(),
  queue: new InMemoryActionQueue(),
  network: new FakeOnlineDetector(),
  replay: () => Promise.resolve(),
})

describe('App', () => {
  it('opens on the create-an-agora form when there is no agora in the address', () => {
    render(<App {...wiring()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Agora' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear el ágora' })).toBeInTheDocument()
  })

  it('lists the agoras this device has already been in', () => {
    const visited = new InMemoryVisitedAgoras()
    visited.remember('abcd1234', 'Cuadrilla')
    visited.remember('efgh5678', 'Piso')

    render(<App {...wiring(visited)} />)

    const list = screen.getByRole('list')
    expect(list).toHaveTextContent('Piso')
    expect(list).toHaveTextContent('Cuadrilla')
  })

  it('lets an agora be taken off this device without touching the server', async () => {
    const visited = new InMemoryVisitedAgoras()
    visited.remember('abcd1234', 'Cuadrilla')
    visited.remember('efgh5678', 'Piso')
    const { default: userEvent } = await import('@testing-library/user-event')

    render(<App {...wiring(visited)} />)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Piso de tu lista' }))

    expect(screen.getByRole('list')).not.toHaveTextContent('Piso')
    expect(screen.getByRole('list')).toHaveTextContent('Cuadrilla')
    expect(visited.list().map((entry) => entry.slug)).toEqual(['abcd1234'])
  })

  it('shows the app version and links to the privacy notice', () => {
    render(<App {...wiring()} />)
    expect(screen.getByText(/Versión/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '#/privacy')
  })

  it('leída sin ágora, la nota describe los dos modos de voto en vez de elegir uno', () => {
    window.location.hash = '#/privacy'
    render(<App {...wiring()} />)
    expect(screen.getByText(/Cada ágora elige al crearse/)).toBeInTheDocument()
  })

  it('no monta ninguna alerta en el formulario de crear ágora hasta que falla el envío', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    render(<App {...wiring()} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Crear el ágora' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El ágora necesita un nombre.')
  })
})

describe('App, un enlace que entra directo', () => {
  async function agora() {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({
      name: 'Cuadrilla',
      creatorName: 'alice',
      ballotOpen: true,
    })
    return { repo, slug }
  }

  it('abre la hoja de redactar desde #/g/<slug>/nueva', async () => {
    const { repo, slug } = await agora()
    window.location.hash = `#/g/${slug}/nueva`

    render(<App {...wiring()} repo={repo} />)

    // Every route that names an agora has to load that agora, or a shared link lands on the
    // home screen and the address is a lie.
    expect(await screen.findByRole('dialog', { name: 'Nueva propuesta' })).toBeInTheDocument()
  })

  it('abre la propuesta desde #/g/<slug>/p/<id>', async () => {
    const { repo, slug } = await agora()
    const id = await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
    window.location.hash = `#/g/${slug}/p/${id}`

    render(<App {...wiring()} repo={repo} />)

    expect(
      await screen.findByRole('dialog', { name: 'Alquilar una furgoneta' }),
    ).toBeInTheDocument()
  })

  it('abre la hoja de editar desde #/g/<slug>/p/<id>/editar', async () => {
    const { repo, slug } = await agora()
    const id = await repo.createProposal({ slug, title: 'Alquilar una furgoneta' })
    window.location.hash = `#/g/${slug}/p/${id}/editar`

    render(<App {...wiring()} repo={repo} />)

    const sheet = await screen.findByRole('dialog', { name: 'Editar la propuesta' })
    expect(within(sheet).getByLabelText('Título')).toHaveValue('Alquilar una furgoneta')
  })

  it('el borrado no vive dentro de «Comparte el ágora»', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const { repo, slug } = await agora()
    window.location.hash = `#/g/${slug}`
    render(<App {...wiring()} repo={repo} />)

    const share = await screen.findByText('Comparte el ágora')
    const shareDetails = share.closest('details')!
    await userEvent.click(share)

    expect(within(shareDetails).queryByText('Borrar el ágora')).toBeNull()
    expect(screen.getByText('Borrar el ágora')).toBeInTheDocument()
  })

  it('la exportación usa su propia cabecera, separada de compartir y de borrar', async () => {
    const { repo, slug } = await agora()
    window.location.hash = `#/g/${slug}`
    render(<App {...wiring()} repo={repo} />)

    const exportHeading = await screen.findByText('Llévate el tablón')
    expect(exportHeading).toBeInTheDocument()

    const exportDetails = exportHeading.closest('details')!
    expect(within(exportDetails).queryByText('Borrar el ágora')).toBeNull()
    expect(within(exportDetails).queryByText('Comparte el ágora')).toBeNull()
  })

  it('cambiar de persona es un objetivo de 44 px, como el enlace de privacidad', async () => {
    // 129x20 px, and the first tab stop on the page. Not a 2.5.8 failure — the nearest other
    // target's centre is 316 px away and it is inline text, so both exceptions apply — but 2.5.5
    // AAA asks for 44 and this is the first thing a keyboard lands on. The bar is read off the
    // privacy link rather than written out here, so the two cannot drift apart.
    const { repo, slug } = await agora()
    window.location.hash = `#/g/${slug}`
    render(<App {...wiring()} repo={repo} />)

    const privacy = await screen.findByRole('link', { name: 'Privacidad' })
    const target = privacy.className.split(/\s+/).filter((name) => name !== 'underline')
    expect(target).toContain('min-h-11')

    const switcher = screen.getByRole('button', { name: 'Cambiar de persona' })
    expect(switcher).toHaveClass(...target)
  })

  it('el enlace de privacidad se lleva el ágora, y la nota dice el modo de voto de esa ágora', async () => {
    // Read from inside an agora the notice is about *that* agora: without the slug in the address
    // it can only describe both modes and name neither, which is worse than the text it replaced.
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({
      name: 'Cuadrilla',
      creatorName: 'alice',
      ballotOpen: false,
    })
    window.location.hash = `#/g/${slug}`
    render(<App {...wiring()} repo={repo} />)

    expect(await screen.findByRole('link', { name: 'Privacidad' })).toHaveAttribute(
      'href',
      `#/g/${slug}/privacidad`,
    )

    window.location.hash = `#/g/${slug}/privacidad`
    expect(await screen.findByText(/Esta ágora tiene el voto secreto/)).toBeInTheDocument()
    expect(screen.queryByText(/Cada ágora elige al crearse/)).toBeNull()
  })

  it('borrar el ágora se distingue visualmente, no es una cuarta caja gris igual', async () => {
    const { repo, slug } = await agora()
    window.location.hash = `#/g/${slug}`
    render(<App {...wiring()} repo={repo} />)

    const dangerHeading = await screen.findByText('Borrar el ágora')
    const dangerDetails = dangerHeading.closest('details')!
    const shareDetails = (await screen.findByText('Comparte el ágora')).closest('details')!

    expect(dangerDetails.style.borderColor).toBe('var(--danger)')
    expect(shareDetails.style.borderColor).not.toBe('var(--danger)')
  })
})
