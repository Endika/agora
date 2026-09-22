import { afterEach, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { InMemoryBoardRepository } from '@/infrastructure/persistence/InMemoryBoardRepository'
import { PrivacyNotice } from '@/presentation/components/legal/PrivacyNotice'
import { renderWithBoard } from '../../support/renderWithBoard'

afterEach(async () => {
  await i18next.changeLanguage('es')
})

/** An agora in one of the two modes, read the way the footer link reads it: by slug. */
async function agoraIn(ballotOpen: boolean) {
  const repo = new InMemoryBoardRepository()
  const { slug } = await repo.createAgora({
    name: 'Cuadrilla',
    creatorName: 'alice',
    ballotOpen,
  })
  return { repo, slug }
}

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

  it('lleva la fecha del día en que dejó de describir un solo modo de voto', () => {
    // A dated notice whose date does not move is a notice that quietly stopped being true. The
    // text below changed, so this changed with it, and the assertion is what keeps the pair honest.
    render(<PrivacyNotice />)
    expect(screen.getByText('Última actualización: 22 de septiembre de 2026')).toBeInTheDocument()
  })

  it('dice lo que no depende del modo, y ya no promete por los dos lo que solo cumple uno', async () => {
    // This paragraph used to end "el sentido de los votos ajenos no sale del servidor: solo se ve
    // cuántas personas han votado y quién falta por votar". It was shown in both modes and it was
    // false in one of them: an open agora publishes the running count by sense while the round is
    // open, and crossing that with `pending` names the voter. The enumeration is what a reviewer
    // followed to find the leak, so what is left here is the half that holds in both modes — no
    // vote carries a name while the round runs — and each mode paragraph now says what its own
    // round shows. A privacy notice may say less than everything; it may not say more than it does.
    const { repo, slug } = await agoraIn(false)
    renderWithBoard(<PrivacyNotice />, { repo, slug })

    // The mode paragraph is what arrives last, so waiting for it is what makes the rest settled.
    await screen.findByText(/Esta ágora tiene el voto secreto/)
    const visible = screen.getByText(/Cualquiera que tenga el enlace del ágora/)
    expect(visible).toHaveTextContent(
      /Mientras una votación está abierta, ningún voto se publica con el nombre de quien lo emitió/,
    )
    expect(visible).toHaveTextContent(/se ve cuántas personas han votado y quién falta por votar/)
    // And it no longer claims that is *all* that shows, because in an open agora it is not.
    expect(visible).not.toHaveTextContent(/el sentido de los votos ajenos no sale del servidor/)
  })

  it('dentro de un ágora abierta dice que el voto resuelto se publica con nombre y no se retira', async () => {
    // The one document where "who can see this" is a legal statement, and it used to assert the
    // open behaviour as the only one there is. It is still exactly right for half the agoras —
    // and this is the half — so the promise has to survive the rewrite word for word: the
    // attribution is permanent and reaches everybody who has the link.
    const { repo, slug } = await agoraIn(true)
    renderWithBoard(<PrivacyNotice />, { repo, slug })

    const visible = await screen.findByText(/Esta ágora tiene el voto abierto/)
    expect(visible).toHaveTextContent(/se publica quién votó qué/)
    expect(visible).toHaveTextContent(
      /cualquiera que tenga el enlace ve el nombre de cada persona junto a su voto/,
    )
    expect(visible).toHaveTextContent(/Así se queda mientras exista el ágora/)
    expect(visible).toHaveTextContent(/no hay forma de volver a ocultarlo/)
    expect(visible).toHaveTextContent(
      /el modo de voto se elige al crear el ágora y no se puede cambiar/,
    )
    // And what this mode shows *during* the round, which is the half the shared paragraph stopped
    // claiming for everybody: the count by sense is live here, and that is the point of it.
    expect(visible).toHaveTextContent(
      /se ve además cómo va el recuento a favor, en contra y en blanco, todavía sin nombres/,
    )
    // And it says it about *this* agora only: neither the other mode nor the "it depends"
    // paragraph is on screen, because a notice that lists two rules names none.
    expect(screen.queryByText(/Esta ágora tiene el voto secreto/)).toBeNull()
    expect(screen.queryByText(/Cada ágora elige al crearse/)).toBeNull()
  })

  it('dentro de un ágora secreta dice que no se publica nunca, ni al resolverse ni después', async () => {
    // The mirror assertion, and the reason the old sentence had to go: in this half of the agoras
    // "se publica quién votó qué" was simply false, and it was false in the one place a person
    // reads before deciding what to vote.
    const { repo, slug } = await agoraIn(false)
    renderWithBoard(<PrivacyNotice />, { repo, slug })

    const visible = await screen.findByText(/Esta ágora tiene el voto secreto/)
    expect(visible).toHaveTextContent(/no se publica nunca quién votó qué/)
    expect(visible).toHaveTextContent(/ni al resolverse la propuesta ni después/)
    expect(visible).toHaveTextContent(
      /El servidor no envía el nombre de quien vota junto a su voto/,
    )
    expect(visible).toHaveTextContent(/no aparece ni en pantalla ni en la exportación/)
    // What a secret ballot does *not* mean: the database still ties the vote to the person, and
    // saying so is the difference between a privacy notice and a marketing claim.
    expect(visible).toHaveTextContent(
      /En la base de datos el voto sigue guardado junto a la persona, para que nadie pueda votar dos veces/,
    )
    // The guarantee that makes the secret mode secret *while* the round runs, and not only at the
    // end: without it, three reads of the board reconstruct the whole ballot with names.
    expect(visible).toHaveTextContent(
      /el recuento a favor, en contra y en blanco no sale del servidor hasta que la propuesta se resuelve/,
    )
    // And the limit of that promise, said out loud. The app shows who has already voted while a
    // round is open, so somebody who looked once can pair that list with whatever closes afterwards.
    // The votes of a partial ballot are therefore never published at all — which is the mitigation,
    // and the notice owes the reader both halves rather than an absolute it cannot keep.
    expect(visible).toHaveTextContent(/durante ese rato es quién ha votado ya/)
    expect(visible).toHaveTextContent(/podría dejar al grupo deducir cómo cayeron los votos/)
    expect(visible).toHaveTextContent(
      /en ese caso, los votos no se publican en absoluto: se ve el resultado y cuántas personas votaron/,
    )
    expect(screen.queryByText(/Esta ágora tiene el voto abierto/)).toBeNull()
    expect(screen.queryByText(/Cada ágora elige al crearse/)).toBeNull()
  })

  it('leída fuera de un ágora describe los dos modos y dice dónde se lee cuál rige', async () => {
    // Reached from the home screen, or from a pasted link, there is no agora to report on. The
    // honest answer is both rules and where the answer for a given agora is written — never one
    // of the two picked as if it were the rule.
    render(<PrivacyNotice />)

    const visible = screen.getByText(/Cada ágora elige al crearse/)
    expect(visible).toHaveTextContent(/después no se puede cambiar/)
    expect(visible).toHaveTextContent(
      /Con el voto abierto, al resolverse una propuesta se publica quién votó qué: cualquiera que tenga el enlace ve el nombre de cada persona junto a su voto/,
    )
    expect(visible).toHaveTextContent(
      /Con el voto secreto no se publica nunca, ni al resolverse ni después/,
    )
    expect(visible).toHaveTextContent(
      /Entra en un ágora y esta misma página te dirá cuál de los dos rige en ella/,
    )
  })

  it('y lo dice en los tres idiomas, no solo en el que se lee por defecto', async () => {
    // Each locale gets the same pair of legal statements it gets in Spanish: the open agora
    // promising a published name, the secret one refusing to promise it ever. The paragraph is
    // located by the sentence that names the mode, and the claim is read off that paragraph, so a
    // translation that kept the words but hung them under the wrong mode fails here.
    for (const [locale, open, secret] of [
      [
        'en',
        [
          /This agora's ballot is open/,
          /anyone holding the link sees each person's name next to their vote/,
        ],
        [
          /This agora's ballot is secret/,
          /who voted what is never published, neither when the proposal resolves nor afterwards/,
        ],
      ],
      [
        'eu',
        [
          /Agora honek botoa irekia du/,
          /lotura duen edonork pertsona bakoitzaren izena ikusten du bere botoaren ondoan/,
        ],
        [
          /Agora honek botoa sekretua du/,
          /ez da inoiz argitaratzen nork zer bozkatu duen, ez proposamena ebaztean ez geroago/,
        ],
      ],
    ] as const) {
      await i18next.changeLanguage(locale)

      for (const [ballotOpen, [marker, claim]] of [
        [true, open],
        [false, secret],
      ] as const) {
        const view = renderWithBoard(<PrivacyNotice />, await agoraIn(ballotOpen))
        expect(await screen.findByText(marker)).toHaveTextContent(claim)
        view.unmount()
      }
    }
    await i18next.changeLanguage('es')
  })

  it('discloses what stays on the device', () => {
    render(<PrivacyNotice />)
    expect(screen.getByText(/Para funcionar sin conexión/)).toBeInTheDocument()
  })
})
