import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { App } from '@/App'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { FakeOnlineDetector } from '@/infrastructure/network/OnlineDetector'
import { InMemoryActionQueue } from '@/infrastructure/sync/IdbActionQueue'
import { InMemoryProposalImages, InMemoryVisitedAgoras } from './support/renderWithBoard'

const wiring = () => ({
  repo: new InMemoryBoardRepository(),
  visited: new InMemoryVisitedAgoras(),
  images: new InMemoryProposalImages(),
  queue: new InMemoryActionQueue(),
  network: new FakeOnlineDetector(),
  replay: () => Promise.resolve(),
})

afterEach(async () => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.lang = 'es'
  await i18next.changeLanguage('es')
})

describe('el pie: idioma y tema alcanzables', () => {
  it('cambiar el idioma actualiza <html lang> y se traduce la interfaz', async () => {
    render(<App {...wiring()} />)

    await userEvent.selectOptions(screen.getByLabelText('Idioma'), 'English')

    expect(document.documentElement.lang).toBe('en')
    expect(await screen.findByRole('button', { name: 'Create the agora' })).toBeInTheDocument()
  })

  it('el idioma elegido persiste en agora:locale, sin escribirlo dos veces', async () => {
    render(<App {...wiring()} />)

    await userEvent.selectOptions(screen.getByLabelText('Idioma'), 'Euskara')

    expect(localStorage.getItem('agora:locale')).toBe('eu')
  })

  it('elegir un tema explícito lo escribe, y volver a automático lo borra', async () => {
    render(<App {...wiring()} />)

    await userEvent.selectOptions(screen.getByLabelText('Tema'), 'Oscuro')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('agora:theme')).toBe('dark')

    await userEvent.selectOptions(screen.getByLabelText('Tema'), 'Automático')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(localStorage.getItem('agora:theme')).toBeNull()
  })

  it('los tres idiomas y los tres temas están en el selector', async () => {
    render(<App {...wiring()} />)

    expect(screen.getByRole('option', { name: 'Castellano' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Euskara' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Automático' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Claro' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Oscuro' })).toBeInTheDocument()
  })
})
