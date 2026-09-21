import { describe, it, expect, beforeEach } from 'vitest'
import { readTheme, applyTheme } from '@/presentation/theme'

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
