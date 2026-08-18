import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'
import { sortProposals } from '@/domain/services/ProposalSorter'

export type ExportFormat = 'md' | 'json'

interface Labels {
  status: (status: string) => string
  tally: (tally: { up: number; down: number; abstain: number }) => string
}

/**
 * The board is the group's, not the app's: this hands it back in a form that outlives Agora. Markdown to
 * read, JSON to reuse — and both are produced from the cached snapshot, so exporting works offline and
 * costs nothing in egress.
 */
export function exportBoard(board: BoardSnapshot, format: ExportFormat, labels: Labels): string {
  if (format === 'json') return JSON.stringify(board, null, 2)

  const nameOf = (id: string | null) =>
    board.participants.find((participant) => participant.id === id)?.name ?? '—'

  const lines: string[] = [`# ${board.group.name}`, '']
  lines.push(board.participants.map((participant) => participant.name).join(' · '), '')

  for (const proposal of sortProposals(board.proposals)) {
    lines.push(`## ${proposal.title}`, '')
    lines.push(`**${labels.status(proposal.status)}** · ${labels.tally(proposal.tally)}`, '')
    if (proposal.tags.length > 0) lines.push(proposal.tags.map((tag) => `#${tag}`).join(' '), '')
    if (proposal.description.trim().length > 0) lines.push(proposal.description.trim(), '')
    if (proposal.closedReason) lines.push(`> ${proposal.closedReason}`, '')

    if (proposal.estimatedCents !== null || proposal.actualCents !== null) {
      const cents = proposal.actualCents ?? proposal.estimatedCents
      lines.push(`${(cents! / 100).toFixed(2)} €`, '')
    }

    const threads = board.threads.filter((thread) => thread.proposalId === proposal.id)
    for (const thread of threads) {
      lines.push(`### ${nameOf(thread.authorId)}${thread.resolvedAt ? ' ✓' : ''}`, '')
      for (const comment of thread.comments) {
        lines.push(`- **${nameOf(comment.authorId)}:** ${comment.body}`)
      }
      if (thread.commentCount > thread.comments.length) {
        lines.push(`- …${thread.commentCount - thread.comments.length}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

/** Filename people can find again: the agora and the day. */
export function exportFilename(board: BoardSnapshot, format: ExportFormat, today: string): string {
  const slug = board.group.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `${slug || board.group.slug}-${today}.${format}`
}
