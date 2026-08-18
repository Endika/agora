import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallPrompt } from '@/presentation/components/pwa/InstallPrompt'

class FakeInstallEvent extends Event {
  prompted = false
  prompt = async () => {
    this.prompted = true
  }
  userChoice = Promise.resolve({ outcome: 'accepted' as const })
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('says nothing until the browser offers an install', () => {
    const { container } = render(<InstallPrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers the real prompt once the browser fires beforeinstallprompt', async () => {
    render(<InstallPrompt />)
    const event = new FakeInstallEvent('beforeinstallprompt')
    window.dispatchEvent(event)

    await userEvent.click(await screen.findByRole('button', { name: 'Instalar' }))
    await waitFor(() => expect(event.prompted).toBe(true))
  })

  it('remembers a dismissal, because being nagged weekly is worse than not installing', async () => {
    const view = render(<InstallPrompt />)
    window.dispatchEvent(new FakeInstallEvent('beforeinstallprompt'))

    await userEvent.click(await screen.findByRole('button', { name: 'No, gracias' }))
    expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument()
    view.unmount()

    // A fresh mount stays quiet: the choice is in localStorage.
    const { container } = render(<InstallPrompt />)
    expect(container).toBeEmptyDOMElement()
  })
})
