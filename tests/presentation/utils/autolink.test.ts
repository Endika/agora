import { describe, it, expect } from 'vitest'
import { autolink } from '@/presentation/utils/autolink'

describe('autolink', () => {
  it('picks the urls out and leaves the rest as text', () => {
    expect(autolink('mira https://example.org y dime')).toEqual([
      { kind: 'text', text: 'mira ' },
      { kind: 'link', url: 'https://example.org' },
      { kind: 'text', text: ' y dime' },
    ])
  })

  it('never produces html, so nothing has to be escaped', () => {
    // The angle brackets stay text: the component renders nodes, not markup.
    expect(autolink('<b>hola</b>')).toEqual([{ kind: 'text', text: '<b>hola</b>' }])
  })

  it('leaves a javascript: url alone, because it is not a link', () => {
    expect(autolink('javascript:alert(1)')).toEqual([{ kind: 'text', text: 'javascript:alert(1)' }])
  })

  it('stops the url at the closing bracket of a parenthesis', () => {
    expect(autolink('(https://example.org)')).toEqual([
      { kind: 'text', text: '(' },
      { kind: 'link', url: 'https://example.org' },
      { kind: 'text', text: ')' },
    ])
  })
})
