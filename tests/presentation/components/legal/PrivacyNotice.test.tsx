import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrivacyNotice } from '@/presentation/components/legal/PrivacyNotice'

describe('PrivacyNotice', () => {
  it('names every processor and where the data actually sits', () => {
    render(<PrivacyNotice />)
    // London, not "the EU": eu-west-2 is the UK, and saying otherwise would be wrong.
    expect(screen.getByText(/Supabase/)).toHaveTextContent(/Londres, Reino Unido/)
    expect(screen.getByText(/GitHub Pages/)).toBeInTheDocument()
  })

  it('says there is no analytics, so there is no cookie banner to explain', () => {
    render(<PrivacyNotice />)
    expect(screen.getByText(/No hay analítica/)).toHaveTextContent(/no hay ninguna que consentir/)
  })

  it('points at the two things a person can actually do', () => {
    render(<PrivacyNotice />)
    const rights = screen.getByText(/Puedes acceder a tus datos/)
    expect(rights).toHaveTextContent(/exportarla en Markdown o JSON/)
    expect(rights).toHaveTextContent(/elimina de verdad las filas y las imágenes/)
  })

  it('discloses what stays on the device', () => {
    render(<PrivacyNotice />)
    expect(screen.getByText(/Para funcionar sin conexión/)).toBeInTheDocument()
  })
})
