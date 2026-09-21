// `zod/mini` rather than `zod`: the same validators and the same inferred types, but the functional
// API tree-shakes, and these schemas sit in the entry chunk because the cached board is parsed
// before the first paint. Its API is functional, so an edit here writes `z.nullable(x)`, not
// `x.nullable()`, and adds refinements with `.check(...)`. The only behavioural difference is that
// issue messages are terser; nothing in the app reads them.
import * as z from 'zod/mini'
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
  round: z.int().check(z.positive()),
  deadline: z.nullable(z.string()),
  closedReason: z.nullable(z.string()),
  estimatedCents: z.nullable(z.int()),
  actualCents: z.nullable(z.int()),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.nullable(z.string()),
  tally: z.object({
    up: z.int(),
    down: z.int(),
    abstain: z.int(),
    cast: z.int(),
    net: z.int(),
  }),
  myVote: z.nullable(voteValue),
  votesRevealed: z.boolean(),
  votes: z.nullable(z.array(z.object({ participantId: z.string(), value: voteValue }))),
  pending: z.array(z.string()),
  images: z.array(
    z.object({
      id: z.string(),
      path: z.string(),
      thumbPath: z.string(),
      width: z.int(),
      height: z.int(),
      position: z.int(),
    }),
  ),
  shares: z.array(z.object({ participantId: z.string(), optedIn: z.boolean() })),
  payments: z.array(
    z.object({
      id: z.string(),
      participantId: z.string(),
      cents: z.int(),
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
      resolvedAt: z.nullable(z.string()),
      resolvedBy: z.nullable(z.string()),
      createdAt: z.string(),
      commentCount: z.int(),
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
      proposalId: z.nullable(z.string()),
      participantId: z.nullable(z.string()),
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

const historyEntry = z.object({
  id: z.string(),
  proposalId: z.nullable(z.string()),
  participantId: z.nullable(z.string()),
  type: z.string(),
  description: z.string(),
  createdAt: z.string(),
})

export const historySchema = z.array(historyEntry)

export const previewSchema = z.object({
  slug: z.string(),
  name: z.string(),
  participants: z.array(participant),
})

export const deleteResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), storage_paths: z.array(z.string()) }),
  z.object({ ok: z.literal(false), error: z.literal('name_mismatch') }),
])

export const versionSchema = z.object({ version: z.string(), proposals: z.int() })
