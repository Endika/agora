import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareAgoraDialog } from '@/presentation/components/identity/ShareAgoraDialog'

describe('ShareAgoraDialog', () => {
  it('shows the link that is the agora, and a qr for it', async () => {
    render(<ShareAgoraDialog slug="abcd1234" />)

    const link = screen.getByRole('link', { name: /abcd1234/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('#/g/abcd1234'))

    const qr = await screen.findByRole('img', { name: /QR/i })
    expect(qr).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
  })
})
