import { afterEach, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { PrivacyNotice } from '@/presentation/components/legal/PrivacyNotice'

afterEach(async () => {
  await i18next.changeLanguage('es')
})

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

  it('dice que un voto resuelto se publica con nombre y no se puede retirar', async () => {
    // The one document where "who can see this" is a legal statement, and it was still describing
    // a ballot that stayed secret in both directions. The material fact a person needs before
    // they vote — and before they share the link — is that the attribution is permanent and
    // reaches everybody who has the link.
    render(<PrivacyNotice />)

    const visible = screen.getByText(/Cualquiera que tenga el enlace del ágora/)
    expect(visible).toHaveTextContent(/se publica quién votó qué/)
    expect(visible).toHaveTextContent(
      /cualquiera que tenga el enlace ve el nombre de cada persona junto a su voto/,
    )
    expect(visible).toHaveTextContent(/así se queda mientras exista el ágora/)
    expect(visible).toHaveTextContent(/No hay forma de volver a ocultarlo/)
    // And the half that was already right stays: nothing leaks while the round is open.
    expect(visible).toHaveTextContent(
      /Mientras una votación está abierta, el sentido de los votos ajenos no sale del servidor/,
    )
  })

  it('y lo dice en los tres idiomas, no solo en el que se lee por defecto', async () => {
    for (const [locale, claim] of [
      ['en', /anyone holding the link sees each person's name next to their vote/],
      ['eu', /lotura duen edonork pertsona bakoitzaren izena ikusten du bere botoaren ondoan/],
    ] as const) {
      await i18next.changeLanguage(locale)
      const view = render(<PrivacyNotice />)
      expect(screen.getByText(claim)).toBeInTheDocument()
      view.unmount()
    }
    await i18next.changeLanguage('es')
  })

  it('discloses what stays on the device', () => {
    render(<PrivacyNotice />)
    expect(screen.getByText(/Para funcionar sin conexión/)).toBeInTheDocument()
  })
})
