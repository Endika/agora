import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * WCAG 3.1.1, Level A. `index.html` hardcodes `lang="es"` and the app then renders in whichever
 * language the device asked for, so unless something writes the attribute the document lies about
 * itself to every screen reader that opens it. axe never caught it: `html-has-lang` only checks
 * that the attribute is there, and it was there, saying the wrong thing.
 *
 * `vi.resetModules()` gives each test its own i18next instance, so what runs here is the real
 * boot — detection included — and not a helper called by hand.
 */
async function boot(locale?: string) {
  document.documentElement.removeAttribute('lang')
  localStorage.clear()
  if (locale !== undefined) localStorage.setItem('agora:locale', locale)
  vi.resetModules()
  const { initI18n } = await import('@/presentation/i18n')
  await initI18n()
  return (await import('i18next')).default
}

describe('<html lang> sigue al idioma de verdad', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.lang = 'es'
  })

  it('el arranque lo escribe, sin que nadie toque el selector', async () => {
    await boot('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('también en euskera', async () => {
    await boot('eu')
    expect(document.documentElement.lang).toBe('eu')
  })

  it('y en castellano, que es el valor que index.html trae puesto', async () => {
    await boot('es')
    expect(document.documentElement.lang).toBe('es')
  })

  it('una primera visita sin nada guardado lo escribe con lo que resuelva el detector', async () => {
    // jsdom reports en-US, so the detector lands on English on a device that has never been here.
    const i18next = await boot()
    expect(i18next.resolvedLanguage).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('y después sigue cada cambio de idioma, venga de donde venga', async () => {
    const i18next = await boot('es')
    await i18next.changeLanguage('eu')
    expect(document.documentElement.lang).toBe('eu')
    await i18next.changeLanguage('en')
    expect(document.documentElement.lang).toBe('en')
  })
})
