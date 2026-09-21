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
  // No `lang = 'es'` here: it used to reset the attribute to the very value the bug left behind,
  // so a test could never tell a working <html lang> from a hardcoded one. Changing the language
  // back is enough — `initI18n` follows it.
  await i18next.changeLanguage('es')
})

describe('el pie: idioma y tema alcanzables', () => {
  it('cambiar el idioma actualiza <html lang> y se traduce la interfaz', async () => {
    render(<App {...wiring()} />)
    expect(document.documentElement.lang).toBe('es')

    await userEvent.selectOptions(screen.getByLabelText('Idioma'), 'English')

    // Written by the i18n layer, not by the picker: the attribute follows the language wherever
    // the language is changed from.
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
