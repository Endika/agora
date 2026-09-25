import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VisitedAgoras } from '@/infrastructure/identity/VisitedAgoras'
import { VisitedAgorasWriteFailed } from '@/domain/ports/VisitedAgorasStore'

const KEY = 'agora:visited'

describe('ágoras visitadas', () => {
  beforeEach(() => localStorage.clear())

  it('sin nada guardado, la lista está vacía y no se escribe nada', () => {
    expect(VisitedAgoras.list()).toEqual([])
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('lee un snapshot literal del formato actual completo y ordenado (la guarda de formato)', () => {
    // Fijado a la forma de hoy: renombrar un campo sin migración debe romper esto, no solo la app.
    const snapshot = [
      { slug: 'efgh5678', name: 'Piso', visitedAt: 2 },
      { slug: 'abcd1234', name: 'Cuadrilla', visitedAt: 1 },
    ]
    localStorage.setItem(KEY, JSON.stringify(snapshot))

    expect(VisitedAgoras.list()).toEqual(snapshot)
  })

  it('JSON roto se lee como lista vacía y la carga no toca lo guardado', () => {
    localStorage.setItem(KEY, '{no es json')

    expect(VisitedAgoras.list()).toEqual([])
    expect(localStorage.getItem(KEY)).toBe('{no es json')
  })

  it('algo que no es una lista también se lee como vacío, sin escribir nada', () => {
    localStorage.setItem(KEY, JSON.stringify({ slug: 'abcd1234' }))

    expect(VisitedAgoras.list()).toEqual([])
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify({ slug: 'abcd1234' }))
  })

  it('un valor totalmente roto no bloquea la lista para siempre: la siguiente visita la reabre', () => {
    localStorage.setItem(KEY, '{no es json')

    VisitedAgoras.remember('abcd1234', 'Cuadrilla')

    // Nada de lo anterior era recuperable, así que se pierde — pero la lista vuelve a escribirse
    // en vez de quedarse rota para siempre.
    expect(VisitedAgoras.list().map((entry) => entry.slug)).toEqual(['abcd1234'])
  })

  it('un elemento con forma inválida se descarta solo, y los demás sobreviven junto a la visita nueva', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { slug: 'abcd1234', name: 'Cuadrilla', visitedAt: 1 },
        { slug: 'efgh5678', name: 7 }, // sin forma de VisitedAgora
      ]),
    )

    VisitedAgoras.remember('ijkl9999', 'Piso nuevo')

    expect(VisitedAgoras.list().map((entry) => entry.slug)).toEqual(['ijkl9999', 'abcd1234'])
  })

  it('un getItem que lanza se lee como lista vacía y no escribe nada', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    try {
      expect(VisitedAgoras.list()).toEqual([])
      expect(setItem).not.toHaveBeenCalled()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })

  it('un fallo real de guarda se informa en vez de perderse en silencio', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      expect(() => VisitedAgoras.remember('abcd1234', 'Cuadrilla')).toThrow(
        VisitedAgorasWriteFailed,
      )
      expect(() => VisitedAgoras.forget('abcd1234')).toThrow(VisitedAgorasWriteFailed)
    } finally {
      setItem.mockRestore()
    }
  })
})
