import { describe, it, expect } from 'vitest'
import { excerpt } from '@/presentation/utils/excerpt'

describe('excerpt', () => {
  it('strips the markdown people would read as noise', () => {
    expect(excerpt('## Plan\n\n- **uno**\n- _dos_')).toBe('Plan · uno · dos')
  })

  it('keeps the words of a link and drops the url', () => {
    expect(excerpt('mira [la ruta](https://example.org/muy/larga)')).toBe('mira la ruta')
  })

  it('never returns markup, so a preview cannot inject anything', () => {
    expect(excerpt('<script>alert(1)</script> hola')).toBe('alert(1) hola')
  })

  it('cuts on a word and says it was cut', () => {
    const long = 'palabra '.repeat(40)
    const short = excerpt(long, 40)
    expect(short.length).toBeLessThanOrEqual(41)
    expect(short.endsWith('…')).toBe(true)
    expect(short).not.toMatch(/palab…$/)
  })

  it('leaves a short description exactly as it reads', () => {
    expect(excerpt('Dos noches y una furgoneta.')).toBe('Dos noches y una furgoneta.')
  })
})
