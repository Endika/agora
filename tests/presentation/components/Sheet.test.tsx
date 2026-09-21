import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet } from '@/presentation/components/Sheet'

// Mirrors BoardPage.tsx's call sites: a fresh inline `onClose` on every render, so a parent
// re-render while the sheet is open (e.g. after an action resolves) must not disturb focus.
function ReRenderingHost({ tick }: { tick: number }) {
  return (
    <Sheet label="Nueva propuesta" onClose={() => {}}>
      <input aria-label="Campo" />
      <span>{tick}</span>
    </Sheet>
  )
}

function Host({ onClose }: { onClose: () => void }) {
  return (
    <>
      <main>
        <button type="button">Detrás</button>
      </main>
      <footer>
        <a href="#/privacy">Privacidad</a>
      </footer>
      <Sheet label="Nueva propuesta" onClose={onClose}>
        <button type="button">Dentro</button>
      </Sheet>
    </>
  )
}

function Opener() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <main>
        <button type="button" onClick={() => setOpen(true)}>
          Nueva propuesta
        </button>
      </main>
      {open && (
        <Sheet label="Nueva propuesta" onClose={() => setOpen(false)}>
          <button type="button">Dentro</button>
        </Sheet>
      )}
    </>
  )
}

describe('Sheet', () => {
  it('inertiza el fondo mientras está abierta', () => {
    render(<Host onClose={vi.fn()} />)
    // Testing-library mounts Host inside its own wrapper div (as the real app mounts it inside
    // #root), so `inert` lands on that wrapper, not literally on `<main>`/`<footer>` — the same
    // place it lands in production. `.closest('[inert]')` checks the effective state instead.
    expect(document.querySelector('main')?.closest('[inert]')).not.toBeNull()
    expect(document.querySelector('footer')?.closest('[inert]')).not.toBeNull()
  })

  it('quita el inert al desmontarse', async () => {
    render(<Opener />)
    await userEvent.click(screen.getByRole('button', { name: 'Nueva propuesta' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(document.querySelector('main')).not.toBeNull()
    expect(document.querySelector('main')?.closest('[inert]')).toBeNull()
  })

  it('el tabulador no sale del panel', async () => {
    render(<Host onClose={vi.fn()} />)
    const visited: string[] = []
    for (let i = 0; i < 8; i++) {
      await userEvent.tab()
      visited.push(document.activeElement?.textContent ?? '')
    }
    expect(new Set(visited)).toEqual(new Set(['Cerrar', 'Dentro']))
    expect(visited).not.toContain('Detrás')
    expect(visited).not.toContain('Privacidad')
  })

  it('bloquea el scroll del fondo mientras está abierta y lo restaura al cerrar', async () => {
    const previous = document.body.style.overflow
    render(<Opener />)
    await userEvent.click(screen.getByRole('button', { name: 'Nueva propuesta' }))
    expect(document.body.style.overflow).toBe('hidden')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(document.body.style.overflow).toBe(previous)
  })

  it('devuelve el foco al control que la abrió', async () => {
    render(<Opener />)
    const opener = screen.getByRole('button', { name: 'Nueva propuesta' })
    await userEvent.click(opener)
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(document.activeElement).toBe(opener)
  })

  it('Escape cierra', async () => {
    const onClose = vi.fn()
    render(<Host onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('el panel recibe el foco al abrirse', () => {
    render(<Host onClose={vi.fn()} />)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })

  it('no pierde el foco cuando el padre se re-renderiza', () => {
    const { rerender } = render(<ReRenderingHost tick={0} />)
    const field = screen.getByLabelText('Campo')
    field.focus()
    expect(document.activeElement).toBe(field)

    rerender(<ReRenderingHost tick={1} />)

    expect(document.activeElement).toBe(field)
  })
})
