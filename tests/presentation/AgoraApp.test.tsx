import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgoraApp } from '@/presentation/AgoraApp'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { FakeOnlineDetector } from '@/infrastructure/network/OnlineDetector'
import { VisitedAgoras } from '@/infrastructure/identity/VisitedAgoras'
import { renderWithBoard } from './support/renderWithBoard'

/** Throws only for the visited-agoras key, so an unrelated write (theme, i18n) is unaffected. */
function breakVisitedWrites() {
  const original = Storage.prototype.setItem
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (key === 'agora:visited') throw new Error('QuotaExceededError')
    return original.call(this, key, value)
  })
}

beforeEach(() => localStorage.clear())

describe('AgoraApp con el adaptador real de ágoras visitadas', () => {
  it('un fallo al recordar la visita no oculta el tablón ya cargado, y se avisa', async () => {
    const repo = new InMemoryBoardRepository()
    const { slug } = await repo.createAgora({
      name: 'Cuadrilla',
      creatorName: 'Ane',
      ballotOpen: true,
    })

    const setItem = breakVisitedWrites()
    try {
      renderWithBoard(
        <AgoraApp network={new FakeOnlineDetector()} route={{ kind: 'board', slug }} />,
        { repo, visited: VisitedAgoras, slug },
      )

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Cuadrilla' }),
      ).toBeInTheDocument()
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se ha podido actualizar la lista de ágoras de este dispositivo.',
      )
    } finally {
      setItem.mockRestore()
    }
  })

  it('quitar una ágora que no se puede guardar avisa y no la borra de la vista', async () => {
    VisitedAgoras.remember('abcd1234', 'Piso viejo')

    const setItem = breakVisitedWrites()
    try {
      renderWithBoard(<AgoraApp network={new FakeOnlineDetector()} route={{ kind: 'home' }} />, {
        visited: VisitedAgoras,
        slug: null,
      })

      await userEvent.click(screen.getByRole('button', { name: 'Quitar Piso viejo de tu lista' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se ha podido actualizar la lista de ágoras de este dispositivo.',
      )
      expect(screen.getByRole('list')).toHaveTextContent('Piso viejo')
    } finally {
      setItem.mockRestore()
    }
  })
})
