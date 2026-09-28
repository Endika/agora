import { describe, it, expect } from 'vitest'
import i18next from 'i18next'
import { errorMessage } from '@/presentation/errorMessage'
import { VisitedAgorasWriteFailed } from '@/domain/ports/VisitedAgorasStore'

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

  it('names the visited-agoras list instead of falling back to the generic write failure', () => {
    expect(errorMessage(new VisitedAgorasWriteFailed(new Error('quota')), t)).toBe(
      'No se ha podido actualizar la lista de ágoras de este dispositivo.',
    )
  })

  it('does not promise to send later what was never queued', () => {
    expect(errorMessage(new TypeError('Failed to fetch'), t, 'write')).toBe(
      'Sin conexión: hace falta para esto. Inténtalo cuando vuelvas a tenerla.',
    )
    expect(errorMessage(new TypeError('Failed to fetch'), t, 'read')).toBe(
      'Sin conexión: hace falta para esto. Inténtalo cuando vuelvas a tenerla.',
    )
  })

  it('says a failed read could not be loaded, not that it could not be saved', () => {
    expect(errorMessage(new Error('relation does not exist'), t, 'read')).toBe(
      'No se ha podido cargar. Inténtalo otra vez.',
    )
  })
})
