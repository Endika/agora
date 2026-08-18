import { describe, it, expect } from 'vitest'
import i18next from 'i18next'
import { errorMessage } from '@/presentation/errorMessage'

const t = i18next.t.bind(i18next)

describe('errorMessage', () => {
  it('turns a database sentence into something a person can act on', () => {
    const cause = Object.assign(new Error('only the creator may edit the proposal'), {
      code: 'PT403',
    })
    expect(errorMessage(cause, t)).toBe('Solo quien creó la propuesta puede hacer eso.')
  })

  it('explains a stale round instead of quoting it', () => {
    const cause = Object.assign(new Error('stale round: the vote moved on'), { code: 'PT409' })
    expect(errorMessage(cause, t)).toBe('Se ha abierto una ronda nueva: vuelve a votar.')
  })

  it('falls back to the code when the message is unfamiliar', () => {
    const cause = Object.assign(new Error('some new constraint fired'), { code: 'PT429' })
    expect(errorMessage(cause, t)).toBe('Demasiadas veces seguidas. Espera un momento.')
  })

  it('says it plainly when there is nothing to recognise, rather than showing a stack trace', () => {
    expect(errorMessage(new Error('TypeError: x is not a function'), t)).toBe(
      'No se ha podido guardar. Inténtalo otra vez.',
    )
  })

  it('recognises a lost network', () => {
    expect(errorMessage(new TypeError('Failed to fetch'), t)).toBe(
      'Sin conexión: se enviará cuando vuelvas a tenerla.',
    )
  })
})
