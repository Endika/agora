import { describe, it, expect, beforeEach, vi } from 'vitest'
import { draftKey, readDraft, writeDraft, clearDraft } from '@/presentation/drafts'

const KEY = draftKey('demoag01')

describe('borradores', () => {
  beforeEach(() => localStorage.clear())

  it('no hay borrador al principio', () => {
    expect(readDraft(KEY)).toBeNull()
  })

  it('guarda y devuelve lo guardado', () => {
    writeDraft(KEY, {
      title: 'Sofá',
      description: 'El de ahora está hundido',
      tags: ['salón'],
      deadline: '',
      cost: '749',
    })
    expect(readDraft(KEY)).toEqual({
      title: 'Sofá',
      description: 'El de ahora está hundido',
      tags: ['salón'],
      deadline: '',
      cost: '749',
    })
  })

  it('separa el borrador de cada propuesta editada', () => {
    expect(draftKey('demoag01')).not.toBe(draftKey('demoag01', 'abc'))
  })

  it('descarta', () => {
    writeDraft(KEY, { title: 'X', description: '', tags: [], deadline: '', cost: '' })
    clearDraft(KEY)
    expect(readDraft(KEY)).toBeNull()
  })

  it('sobrevive a un localStorage roto', () => {
    localStorage.setItem(KEY, '{no es json')
    expect(readDraft(KEY)).toBeNull()
  })

  it('no revienta cuando el almacén no deja escribir ni borrar', () => {
    // Safari in private mode and a full store both throw from setItem, and the form calls this on
    // every keystroke: an exception here would take the whole sheet down mid-sentence.
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    try {
      expect(() =>
        writeDraft(KEY, { title: 'X', description: '', tags: [], deadline: '', cost: '' }),
      ).not.toThrow()
      expect(() => clearDraft(KEY)).not.toThrow()
    } finally {
      setItem.mockRestore()
      removeItem.mockRestore()
    }
  })

  it('no devuelve medio borrador cuando lo guardado no tiene forma de borrador', () => {
    localStorage.setItem(KEY, JSON.stringify({ title: 7, description: 'algo' }))
    expect(readDraft(KEY)).toBeNull()

    localStorage.setItem(KEY, JSON.stringify({ title: 'Sofá', tags: 'salón' }))
    expect(readDraft(KEY)).toEqual({
      title: 'Sofá',
      description: '',
      tags: [],
      deadline: '',
      cost: '',
    })
  })
})
