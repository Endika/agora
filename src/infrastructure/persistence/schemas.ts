import { z } from 'zod'
import type { BoardSnapshot } from '@/domain/repositories/BoardRepository'

const voteValue = z.enum(['up', 'down', 'abstain'])

const participant = z.object({ id: z.string(), name: z.string() })

const proposal = z.object({
  id: z.string(),
  groupId: z.string(),
  createdBy: z.string(),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  // English on the wire: the Spanish names in the spec's prose are a UI concern.
  status: z.enum(['open', 'approved', 'rejected', 'debating', 'completed', 'closed']),
  round: z.number().int().positive(),
  deadline: z.string().nullable(),
  closedReason: z.string().nullable(),
  estimatedCents: z.number().int().nullable(),
  actualCents: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  tally: z.object({
    up: z.number().int(),
    down: z.number().int(),
    abstain: z.number().int(),
    cast: z.number().int(),
    net: z.number().int(),
  }),
  myVote: voteValue.nullable(),
  votesRevealed: z.boolean(),
  votes: z.array(z.object({ participantId: z.string(), value: voteValue })).nullable(),
  pending: z.array(z.string()),
  images: z.array(
    z.object({
      id: z.string(),
      path: z.string(),
      thumbPath: z.string(),
      width: z.number().int(),
      height: z.number().int(),
      position: z.number().int(),
    }),
  ),
  shares: z.array(z.object({ participantId: z.string(), optedIn: z.boolean() })),
  liquidations: z.array(
    z.object({
      id: z.string(),
      cents: z.number().int(),
      paidBy: z.string().nullable(),
      affects: z.array(z.string()),
      paidShares: z.array(z.string()),
      createdAt: z.string(),
    }),
  ),
  links: z.array(z.object({ toId: z.string(), kind: z.enum(['related', 'supersedes']) })),
})

export const boardSnapshotSchema = z.object({
  version: z.string(),
  group: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  me: participant,
  participants: z.array(participant),
  proposals: z.array(proposal),
  threads: z.array(
    z.object({
      id: z.string(),
      proposalId: z.string(),
      authorId: z.string(),
      resolvedAt: z.string().nullable(),
      resolvedBy: z.string().nullable(),
      createdAt: z.string(),
      commentCount: z.number().int(),
      comments: z.array(
        z.object({
          id: z.string(),
          authorId: z.string(),
          body: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
  ),
  history: z.array(
    z.object({
      id: z.string(),
      proposalId: z.string().nullable(),
      participantId: z.string().nullable(),
      type: z.string(),
      description: z.string(),
      createdAt: z.string(),
    }),
  ),
})

/** The wire is not trusted: a payload that does not match the contract stops here, not in a view. */
export function parseBoard(raw: unknown): BoardSnapshot {
  return boardSnapshotSchema.parse(raw)
}

export const identitySchema = z.object({
  ok: z.literal(true),
  slug: z.string(),
  participant_id: z.string(),
})

const comment = z.object({
  id: z.string(),
  authorId: z.string(),
  body: z.string(),
  createdAt: z.string(),
})

export const commentsSchema = z.array(comment)

export const previewSchema = z.object({
  slug: z.string(),
  name: z.string(),
  participants: z.array(participant),
})

export const deleteResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), storage_paths: z.array(z.string()) }),
  z.object({ ok: z.literal(false), error: z.literal('name_mismatch') }),
])

export const versionSchema = z.object({ version: z.string(), proposals: z.number().int() })
