import { describe, it, expect, onTestFinished, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import type { CastVote, VoteValue } from '@/domain/entities/Proposal'
import type { Participant } from '@/domain/repositories/BoardRepository'
import { PsephoiRow } from '@/presentation/components/vote/PsephoiRow'

const SECRET =
  'Nadie ve tu voto hasta que se alcanza el quórum. Después lo ve todo el grupo, con tu nombre.'

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
    render(<PsephoiRow participants={crowd(5)} cast={2} revealed={null} explainSecret />)
    expect(screen.getByText(SECRET)).toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('quórum')
  })

  it('avisa de que el voto acaba llevando tu nombre, no solo de que se verá', () => {
    // The whole point of the sentence: a row of anonymous grey pebbles reads as a secret ballot,
    // and somebody who only learns at quorum that their "En contra" is signed learned it too late.
    render(<PsephoiRow participants={crowd(5)} cast={2} revealed={null} explainSecret />)
    const line = screen.getByText(SECRET).textContent ?? ''
    expect(line).toContain('Nadie ve tu voto')
    expect(line).toContain('con tu nombre')
  })

  it('no lo dice si el llamador no lo pide, aunque el voto siga siendo secreto', () => {
    render(<PsephoiRow participants={crowd(5)} cast={2} revealed={null} explainSecret={false} />)
    expect(screen.queryByText(SECRET)).toBeNull()
  })

  it('deja de decirlo una vez revelados, y no lo dice dos veces por voz', () => {
    const voters = people('Amaia', 'Iker')
    render(
      <PsephoiRow
        participants={voters}
        cast={2}
        revealed={ballots(voters, 'up', 'down')}
        explainSecret
      />,
    )
    expect(screen.queryByText(SECRET)).toBeNull()
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('quórum')
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
    expect(pebbles[0]).toHaveAttribute('title', 'Ekin: A favor')
    expect(pebbles[1]).toHaveAttribute('title', 'Iker: En contra')
    expect(pebbles[2]).toHaveAttribute('title', 'Jon: En blanco')
    // The abstain pebble is a ring, so it can never be mistaken for an unrevealed stone.
    expect(pebbles[2]!.className).toContain('border')
    expect(pebbles[0]!.className).not.toContain('border')
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
    expect(screen.getAllByTestId('pebble-cast')[1]).toHaveAttribute('title', 'En contra')
  })

  it('MIENTRAS SIGUE ABIERTA no hay ni un nombre junto a un sentido', () => {
    const voters = people('Ekin', 'Amaia', 'Iker')
    const { container } = render(
      <PsephoiRow participants={voters} cast={3} revealed={null} explainSecret />,
    )

    // No roll, no colours, and no pebble that can be hovered for an answer. Secrecy during the
    // round is the whole premise: if any of these three go, the round is not secret any more.
    expect(screen.queryByTestId('vote-roll')).toBeNull()
    expect(container.querySelectorAll('[data-vote]')).toHaveLength(0)
    for (const pebble of screen.getAllByTestId('pebble-cast')) {
      expect(pebble).not.toHaveAttribute('title')
    }

    // Belt and braces: no name is anywhere in this subtree at all while the vote is open.
    const text = container.textContent ?? ''
    for (const person of voters) expect(text).not.toContain(person.name)
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
