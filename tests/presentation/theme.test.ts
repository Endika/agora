import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { readTheme, applyTheme, THEME_KEY } from '@/presentation/theme'

describe('tema', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('por defecto sigue al sistema', () => {
    expect(readTheme()).toBe('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('una elección explícita se escribe y se relee', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('agora:theme')).toBe('dark')
    expect(readTheme()).toBe('dark')
  })

  it('claro también se escribe y se relee', () => {
    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('agora:theme')).toBe('light')
    expect(readTheme()).toBe('light')
  })

  it('volver a sistema limpia las dos cosas', () => {
    applyTheme('light')
    applyTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(localStorage.getItem('agora:theme')).toBeNull()
    expect(readTheme()).toBe('system')
  })

  it('un valor guardado que no es "dark" ni "light" también se lee como sistema', () => {
    localStorage.setItem('agora:theme', 'auto')
    expect(readTheme()).toBe('system')
  })
})

describe('la clave del tema y el arranque en línea de index.html', () => {
  it('leen y escriben exactamente la misma clave', () => {
    // index.html applies the stored theme before the first paint, so it cannot import this module
    // and has to write the string out. Nothing tied the two: renaming the constant here left the
    // page loading in the system theme on every reload, with 337 tests green.
    const html = readFileSync('index.html', 'utf8')
    expect(html).toContain(`localStorage.getItem('${THEME_KEY}')`)
  })

  it('y el arranque sigue siendo el que aplica el atributo antes de pintar', () => {
    // Without this, the check above would still pass against a bootstrap that read the key and
    // then did nothing with it.
    const html = readFileSync('index.html', 'utf8')
    const bootstrap = html.slice(html.indexOf('<script>'), html.indexOf('</script>'))
    expect(bootstrap).toContain(THEME_KEY)
    expect(bootstrap).toContain("setAttribute('data-theme'")
  })
})
