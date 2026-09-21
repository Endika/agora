import { describe, it, expect, onTestFinished, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import type { CastVote, VoteValue } from '@/domain/entities/Proposal'
import type { Participant } from '@/domain/repositories/BoardRepository'
import { PsephoiRow } from '@/presentation/components/vote/PsephoiRow'

const SECRET =
  'Nadie ve tu voto hasta que se alcanza el quórum. Después lo ve todo el grupo, con tu nombre.'
const SECRET_PAST =
  'Nadie vio estos votos hasta que se alcanzó el quórum. Ahora los ve todo el grupo, con el nombre de quien los puso.'
/** The same two, in an agora whose ballot never opens: no name is promised in either tense. */
const FOREVER =
  'Nadie ve tu voto hasta que se alcanza el quórum. Después lo ve todo el grupo, y nunca lleva tu nombre.'
const FOREVER_PAST =
  'Nadie vio estos votos hasta que se alcanzó el quórum. Ahora los ve todo el grupo, y ninguno lleva un nombre.'
/** Counted together wherever the question is "how many of these are on screen". */
const ALL = [SECRET, SECRET_PAST, FOREVER, FOREVER_PAST]

/** Named people, in the order their votes are handed to the row. */
function people(...names: string[]): Participant[] {
  return names.map((name, index) => ({ id: `p${index}`, name }))
}

/** A cohort of the given size, for the tests that only care how many slots there are. */
function crowd(count: number): Participant[] {
  return people(...Array.from({ length: count }, (_, index) => `Persona ${index + 1}`))
}

/** The i-th value belongs to the i-th participant, which is also the order the pebbles sit in. */
function ballots(voters: Participant[], ...values: VoteValue[]): CastVote[] {
  return values.map((value, index) => ({ participantId: voters[index]!.id, value }))
}

/** A secret agora's reveal: the senses arrive, and there is nobody to pin them on. */
function unsigned(...values: VoteValue[]): CastVote[] {
  return values.map((value) => ({ value }))
}

describe('PsephoiRow', () => {
  it('shows one slot per participant, empty for whoever has not voted', () => {
    render(<PsephoiRow participants={crowd(4)} cast={2} revealed={null} explainSecret={false} />)
    expect(screen.getAllByTestId('pebble-cast')).toHaveLength(2)
    expect(screen.getAllByTestId('pebble-empty')).toHaveLength(2)
  })

  it('carries no sentiment at all while the vote is open', () => {
    const { container } = render(
      <PsephoiRow participants={crowd(4)} cast={4} revealed={null} explainSecret={false} />,
    )
    expect(container.querySelectorAll('[data-vote]')).toHaveLength(0)
  })

  it('dice en pantalla la regla entera de la papeleta cuando el llamador lo pide, sin duplicarla por voz', () => {
    render(<PsephoiRow participants={crowd(5)} cast={2} revealed={null} explainSecret ballotOpen />)
    expect(screen.getByText(SECRET)).toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('quórum')
  })

  it('avisa de que el voto acaba llevando tu nombre, no solo de que se verá', () => {
    // The whole point of the sentence: a row of anonymous grey pebbles reads as a secret ballot,
    // and somebody who only learns at quorum that their "En contra" is signed learned it too late.
    render(<PsephoiRow participants={crowd(5)} cast={2} revealed={null} explainSecret ballotOpen />)
    const line = screen.getByText(SECRET).textContent ?? ''
    expect(line).toContain('Nadie ve tu voto')
    expect(line).toContain('con tu nombre')
  })

  it('no lo dice si el llamador no lo pide, aunque el voto siga siendo secreto', () => {
    render(<PsephoiRow participants={crowd(5)} cast={2} revealed={null} explainSecret={false} />)
    expect(screen.queryByText(SECRET)).toBeNull()
  })

  it('una vez revelados pasa al pasado en vez de callarse, y sigue sin decirlo por voz', () => {
    const voters = people('Amaia', 'Iker')
    render(
      <PsephoiRow
        participants={voters}
        cast={2}
        revealed={ballots(voters, 'up', 'down')}
        explainSecret
        ballotOpen
      />,
    )
    // Somebody who arrives here through a shared link sees their own name against a sense and has
    // never read the forward-looking promise. Going silent is what left them with no explanation.
    expect(screen.queryByText(SECRET)).toBeNull()
    expect(screen.getByText(SECRET_PAST)).toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('quórum')
  })

  it('la regla se dice una sola vez en cualquiera de los dos tiempos, nunca las dos', () => {
    const voters = people('Amaia', 'Iker')
    const both = () => ALL.flatMap((sentence) => screen.queryAllByText(sentence))

    const open = render(
      <PsephoiRow participants={voters} cast={1} revealed={null} explainSecret ballotOpen />,
    )
    expect(both()).toHaveLength(1)
    open.unmount()

    render(
      <PsephoiRow
        participants={voters}
        cast={2}
        revealed={ballots(voters, 'up', 'down')}
        explainSecret
        ballotOpen
      />,
    )
    expect(both()).toHaveLength(1)
  })

  it('el pasado también nombra el precio: el grupo y el nombre', () => {
    const voters = people('Amaia')
    render(
      <PsephoiRow
        participants={voters}
        cast={1}
        revealed={ballots(voters, 'up')}
        explainSecret
        ballotOpen
      />,
    )
    const line = screen.getByText(SECRET_PAST).textContent ?? ''
    expect(line).toContain('Nadie vio estos votos')
    expect(line).toContain('con el nombre de quien los puso')
  })

  it('en un ágora secreta la promesa no nombra a nadie, y no se cumple de más', () => {
    render(
      <PsephoiRow
        participants={crowd(5)}
        cast={2}
        revealed={null}
        explainSecret
        ballotOpen={false}
      />,
    )

    const line = screen.getByText(FOREVER).textContent ?? ''
    expect(line).toContain('nunca lleva tu nombre')
    // The open agora's promise is the one that costs a name, and it must not leak into an agora
    // that never publishes one.
    expect(screen.queryByText(SECRET)).toBeNull()
  })

  it('resuelta y secreta, sigue sin prometer nombres en vez de caer en el pasado del otro modo', () => {
    // The lie this whole prop exists to stop. `revealed` alone cannot tell the two agoras apart,
    // and a row that only reads it lands on «con el nombre de quien los puso» over a roll that
    // will never exist.
    render(
      <PsephoiRow
        participants={people('Amaia', 'Iker')}
        cast={2}
        revealed={unsigned('up', 'down')}
        explainSecret
        ballotOpen={false}
      />,
    )

    expect(screen.getByText(FOREVER_PAST)).toBeInTheDocument()
    expect(screen.queryByText(SECRET_PAST)).toBeNull()
    expect(screen.queryByText(FOREVER)).toBeNull()
    // And what it promises is a property of the record, which the app can keep: the votes carry no
    // name. Not that nobody can work it out — in a flat of two, a 1-1 tells each voter the other's
    // vote, and a sentence claiming otherwise would be the same kind of lie in the other direction.
    expect(screen.getByText(FOREVER_PAST).textContent ?? '').toContain('ninguno lleva un nombre')
  })

  it('las cuatro variantes son una sola frase: una por modo y tiempo, nunca dos', () => {
    const voters = people('Amaia', 'Iker')
    const said = () => ALL.flatMap((line) => screen.queryAllByText(line))

    for (const ballotOpen of [true, false]) {
      for (const [revealed, expected] of [
        [null, ballotOpen ? SECRET : FOREVER],
        [
          ballotOpen ? ballots(voters, 'up', 'down') : unsigned('up', 'down'),
          ballotOpen ? SECRET_PAST : FOREVER_PAST,
        ],
      ] as const) {
        const view = render(
          <PsephoiRow
            participants={voters}
            cast={2}
            revealed={revealed}
            explainSecret
            ballotOpen={ballotOpen}
          />,
        )
        expect(said().map((node) => node.textContent)).toEqual([expected])
        view.unmount()
      }
    }
  })

  it('un ágora secreta no pinta rollo, porque sus votos no traen a quién', () => {
    const voters = people('Amaia', 'Iker')
    const { container } = render(
      <PsephoiRow
        participants={voters}
        cast={2}
        revealed={unsigned('up', 'down')}
        explainSecret
        ballotOpen={false}
      />,
    )

    // The colours arrive — the count is public — and the attribution has nowhere to come from.
    expect(container.querySelectorAll('[data-vote]')).toHaveLength(2)
    expect(screen.queryByTestId('vote-roll')).toBeNull()
    for (const person of voters) expect(container.textContent ?? '').not.toContain(person.name)
  })

  it('reveals every pebble once the proposal resolved', () => {
    const voters = crowd(4)
    render(
      <PsephoiRow
        participants={voters}
        cast={4}
        revealed={ballots(voters, 'up', 'abstain', 'abstain', 'abstain')}
        explainSecret={false}
      />,
    )
    const pebbles = screen.getAllByTestId('pebble-cast')
    expect(pebbles[0]).toHaveAttribute('data-vote', 'up')
    expect(pebbles[1]).toHaveAttribute('data-vote', 'abstain')
    expect(screen.queryAllByTestId('pebble-empty')).toHaveLength(0)
  })

  it('tells the three votes apart by shape as well as colour', () => {
    const voters = people('Ekin', 'Iker', 'Jon')
    render(
      <PsephoiRow
        participants={voters}
        cast={3}
        revealed={ballots(voters, 'up', 'down', 'abstain')}
        explainSecret={false}
      />,
    )
    const pebbles = screen.getAllByTestId('pebble-cast')
    expect(pebbles[0]).toHaveAttribute('data-vote', 'up')
    expect(pebbles[1]).toHaveAttribute('data-vote', 'down')
    expect(pebbles[2]).toHaveAttribute('data-vote', 'abstain')
    // The abstain pebble is a ring, so it can never be mistaken for an unrevealed stone.
    expect(pebbles[2]!.className).toContain('border')
    expect(pebbles[0]!.className).not.toContain('border')
  })

  it('ninguna piedra promete con un title una accesibilidad que no da', () => {
    const voters = people('Ekin', 'Iker')
    const { container } = render(
      <PsephoiRow
        participants={voters}
        cast={2}
        revealed={ballots(voters, 'up', 'down')}
        explainSecret={false}
      />,
    )
    // Under role="img" the pebbles are presentational: a title lands as a description on a
    // nameless generic, reachable by a mouse and by nothing else. The roll below publishes the
    // same attribution as real text, to everybody.
    expect(container.querySelectorAll('[title]')).toHaveLength(0)
    expect(screen.getByTestId('roll-up')).toHaveTextContent('A favor: Ekin')
  })

  it('dice quién votó qué, agrupado por sentido, una vez resuelta', () => {
    const voters = people('Ekin', 'Jon', 'Amaia', 'Iker', 'Maddi')
    render(
      <PsephoiRow
        participants={voters}
        cast={5}
        revealed={ballots(voters, 'up', 'abstain', 'up', 'down', 'up')}
        explainSecret={false}
      />,
    )

    const roll = screen.getByTestId('vote-roll')
    expect(within(roll).getByTestId('roll-up')).toHaveTextContent('A favor: Ekin, Amaia, Maddi')
    expect(within(roll).getByTestId('roll-abstain')).toHaveTextContent('En blanco: Jon')
    expect(within(roll).getByTestId('roll-down')).toHaveTextContent('En contra: Iker')

    // In favour, blank, against — the same reading order every time, whatever order they voted in.
    const senses = [...roll.querySelectorAll('[data-testid^="roll-"]')].map((node) =>
      node.getAttribute('data-testid'),
    )
    expect(senses).toEqual(['roll-up', 'roll-abstain', 'roll-down'])
  })

  it('no inventa un grupo para un sentido que nadie votó', () => {
    const voters = people('Ekin', 'Amaia')
    render(
      <PsephoiRow
        participants={voters}
        cast={2}
        revealed={ballots(voters, 'up', 'up')}
        explainSecret={false}
      />,
    )
    expect(screen.getByTestId('roll-up')).toHaveTextContent('A favor: Ekin, Amaia')
    expect(screen.queryByTestId('roll-down')).toBeNull()
    expect(screen.queryByTestId('roll-abstain')).toBeNull()
  })

  it('los nombres cuelgan bajo su etiqueta en vez de alinearse con la siguiente', () => {
    const voters = people('Ekin', 'Iker')
    render(
      <PsephoiRow
        participants={voters}
        cast={2}
        revealed={ballots(voters, 'up', 'down')}
        explainSecret={false}
      />,
    )
    // A continuation line flush with the next group's label leaves --ink against --ink-muted as
    // the only thing separating them, which at 280 px is too little. jsdom computes no Tailwind,
    // so the real check is the browser measurement in the report; this only stops the pair being
    // deleted without anybody noticing.
    const group = screen.getByTestId('roll-up')
    expect(group.className).toContain('pl-4')
    expect(group.className).toContain('-indent-4')
  })

  it('la lista de nombres se presenta con su propio nombre accesible', () => {
    const voters = people('Ekin', 'Iker')
    render(
      <PsephoiRow
        participants={voters}
        cast={2}
        revealed={ballots(voters, 'up', 'down')}
        explainSecret={false}
      />,
    )
    // The pebble row is a single role="img", so its pebbles are not reachable one by one: this
    // list is the only way the attribution reaches a screen reader.
    const roll = screen.getByRole('list', { name: 'Quién votó qué' })
    expect(roll).toBe(screen.getByTestId('vote-roll'))
    // And it must not restate the tally the row already announces.
    expect(roll.getAttribute('aria-label')).not.toMatch(/\d+ de \d+/)
  })

  it('un voto de alguien que ya no está no se imprime sin nombre', () => {
    render(
      <PsephoiRow
        participants={people('Ekin')}
        cast={2}
        revealed={[
          { participantId: 'p0', value: 'up' },
          { participantId: 'quien-fue-borrado', value: 'down' },
        ]}
        explainSecret={false}
      />,
    )
    expect(screen.getByTestId('roll-up')).toHaveTextContent('A favor: Ekin')
    expect(screen.queryByTestId('roll-down')).toBeNull()
    // The pebble stays: the vote was cast and still counts, it just has nobody left to name.
    expect(screen.getAllByTestId('pebble-cast')).toHaveLength(2)
    expect(screen.getAllByTestId('pebble-cast')[1]).toHaveAttribute('data-vote', 'down')
  })

  it('MIENTRAS SIGUE ABIERTA no hay ni un nombre junto a un sentido', () => {
    const voters = people('Ekin', 'Amaia', 'Iker')
    const { container } = render(
      <PsephoiRow participants={voters} cast={3} revealed={null} explainSecret ballotOpen />,
    )

    // No roll and no colours. Secrecy during the round is the whole premise.
    expect(screen.queryByTestId('vote-roll')).toBeNull()
    expect(container.querySelectorAll('[data-vote]')).toHaveLength(0)

    // And no name reaches the page by any route: not as text, and not smuggled into an attribute
    // such as title, aria-label or data-*, which is where it would go if somebody tried again.
    const carriers = [container.textContent ?? '']
    for (const node of container.querySelectorAll('*')) {
      for (const attribute of node.attributes) carriers.push(attribute.value)
    }
    for (const person of voters) {
      for (const carrier of carriers) expect(carrier).not.toContain(person.name)
    }
  })

  it('marca tu piedra sin decir por dónde fue', () => {
    render(
      <PsephoiRow participants={crowd(5)} cast={3} revealed={null} explainSecret={false} mine />,
    )

    const own = screen.getByTestId('pebble-mine')
    // Presence, never direction: the ring says "yours is in" and nothing else. If this ever
    // carries a vote, the secret ballot is over.
    expect(own).not.toHaveAttribute('data-vote')
    expect(own).not.toHaveAttribute('title')
    expect(own.style.outline).toContain('var(--ink)')
    // And it is stone, exactly like every other pebble in the row.
    const others = screen.getAllByTestId('pebble-cast')
    expect(others).toHaveLength(2)
    for (const other of others) expect(other.style.background).toBe(own.style.background)
    expect(own.style.background).toBe('var(--pebble)')
  })

  it('no marca nada si todavía no has votado', () => {
    render(<PsephoiRow participants={crowd(5)} cast={3} revealed={null} explainSecret={false} />)
    expect(screen.queryByTestId('pebble-mine')).toBeNull()
    expect(screen.getAllByTestId('pebble-cast')).toHaveLength(3)
  })

  it('deja de señalar tu piedra en cuanto se revelan los votos', () => {
    const voters = people('Ekin', 'Iker')
    render(
      <PsephoiRow
        participants={voters}
        cast={2}
        revealed={ballots(voters, 'up', 'down')}
        explainSecret={false}
        mine
      />,
    )
    // With every pebble coloured, pointing at one of them and calling it yours would hand over
    // the answer to anyone looking at the screen.
    expect(screen.queryByTestId('pebble-mine')).toBeNull()
    for (const pebble of screen.getAllByTestId('pebble-cast')) {
      expect(pebble.style.outline).toBe('')
    }
  })

  it('dice también por voz que tu voto ya está dentro, sin decir cuál', () => {
    render(
      <PsephoiRow participants={crowd(5)} cast={3} revealed={null} explainSecret={false} mine />,
    )
    const label = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(label).toContain('tu voto incluido')
    for (const word of ['favor', 'contra', 'blanco']) expect(label).not.toContain(word)
  })

  it('tu piedra aterriza cuando llega, y la fila revelada entra escalonada', () => {
    const voters = crowd(3)
    const { rerender, unmount } = render(
      <PsephoiRow participants={voters} cast={0} revealed={null} explainSecret={false} />,
    )
    rerender(
      <PsephoiRow participants={voters} cast={1} revealed={null} explainSecret={false} mine />,
    )

    const own = screen.getByTestId('pebble-mine')
    expect(own).toHaveAttribute('data-motion', 'pebble-land')
    // Pinned: 180 ms is a landing, 4 s is a distraction nobody asked for.
    expect(own.style.animation).toBe('pebble-land 180ms ease-out both')
    unmount()

    render(
      <PsephoiRow
        participants={voters}
        cast={3}
        revealed={ballots(voters, 'up', 'down', 'abstain')}
        explainSecret={false}
      />,
    )
    const pebbles = screen.getAllByTestId('pebble-cast')
    for (const pebble of pebbles) {
      expect(pebble).toHaveAttribute('data-motion', 'row-reveal')
      expect(pebble.style.animation).toContain('row-reveal')
    }
    // Staggered, so the row reads as one thing arriving rather than three separate blinks.
    expect(pebbles[0]!.style.animationDelay).toBe('0ms')
    expect(pebbles[2]!.style.animationDelay).toBe('80ms')
  })

  it('tu piedra es siempre la primera, y no se mueve cuando votan las demás personas', () => {
    const voters = crowd(5)
    const { rerender } = render(
      <PsephoiRow participants={voters} cast={1} revealed={null} explainSecret={false} mine />,
    )
    const row = screen.getByRole('img')
    const position = () =>
      [...row.children].findIndex((el) => el.matches('[data-testid="pebble-mine"]'))
    expect(position()).toBe(0)

    // Three more people vote. The ring stays where it is: there is no person-to-pebble mapping,
    // and a marker that migrates while you watch invents one.
    for (const cast of [2, 3, 4]) {
      rerender(
        <PsephoiRow participants={voters} cast={cast} revealed={null} explainSecret={false} mine />,
      )
      expect(position()).toBe(0)
    }
  })

  it('la ceremonia es de tu voto: no se repite porque vote otra persona', () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })

    const voters = crowd(5)
    const { rerender } = render(
      <PsephoiRow participants={voters} cast={0} revealed={null} explainSecret={false} />,
    )
    rerender(
      <PsephoiRow participants={voters} cast={1} revealed={null} explainSecret={false} mine />,
    )
    expect(screen.getByTestId('pebble-mine')).toHaveAttribute('data-motion', 'pebble-land')

    const settled = screen.getByTestId('pebble-mine')
    act(() => vi.advanceTimersByTime(500))
    expect(settled).not.toHaveAttribute('data-motion')

    // Somebody else votes. Nothing of yours happened, so nothing of yours animates.
    rerender(
      <PsephoiRow participants={voters} cast={2} revealed={null} explainSecret={false} mine />,
    )
    rerender(
      <PsephoiRow participants={voters} cast={3} revealed={null} explainSecret={false} mine />,
    )
    const own = screen.getByTestId('pebble-mine')
    // The very same node, too: a remount would restart the animation on its own.
    expect(own).toBe(settled)
    expect(own).not.toHaveAttribute('data-motion')
    expect(own.style.animation).toBe('')
    // The ring itself stays on, of course. It is the movement that is over, not the fact.
    expect(own.style.outline).toContain('var(--ink)')
  })

  it('un voto que ya estaba puesto no vuelve a aterrizar al abrir el tablón', () => {
    render(
      <PsephoiRow participants={crowd(5)} cast={3} revealed={null} explainSecret={false} mine />,
    )
    const own = screen.getByTestId('pebble-mine')
    expect(own).not.toHaveAttribute('data-motion')
    expect(own.style.animation).toBe('')
    expect(own.style.outline).toContain('var(--ink)')
  })

  it('las piedras se remontan al revelarse, para que la animación llegue a correr', () => {
    const voters = crowd(2)
    const { rerender } = render(
      <PsephoiRow participants={voters} cast={2} revealed={null} explainSecret={false} />,
    )
    const before = screen.getAllByTestId('pebble-cast')[0]!
    rerender(
      <PsephoiRow
        participants={voters}
        cast={2}
        revealed={ballots(voters, 'up', 'up')}
        explainSecret={false}
      />,
    )
    // A CSS animation on a node that never left the DOM never plays. Same position, new node.
    expect(screen.getAllByTestId('pebble-cast')[0]).not.toBe(before)
  })

  it('announces the count for anyone not seeing the pebbles', () => {
    render(<PsephoiRow participants={crowd(5)} cast={3} revealed={null} explainSecret={false} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(/3.*5/)
  })
})
