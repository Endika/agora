import type { VoteValue } from '@/domain/entities/Proposal'

/**
 * A write that is waiting for a network. Every one of them carries whatever id the server needs to make a
 * replay harmless: a vote is an upsert on (proposal, participant, round), and threads and comments carry
 * the uuidv7 the client made. That is why this queue needs no dedup table of its own.
 */
export type QueuedAction =
  | { kind: 'castVote'; proposalId: string; round: number; value: VoteValue }
  | { kind: 'addThread'; threadId: string; proposalId: string; commentId: string; body: string }
  | { kind: 'addComment'; commentId: string; threadId: string; body: string }
  | { kind: 'setThreadResolved'; threadId: string; resolved: boolean }
  | { kind: 'setExpenseShare'; proposalId: string; optedIn: boolean }

export interface QueuedEntry {
  /** uuidv7: time-ordered, so FIFO needs no separate sequence. */
  id: string
  action: QueuedAction
  queuedAt: string
}

export interface FailedEntry extends QueuedEntry {
  reason: string
}

export interface ActionQueue {
  enqueue(action: QueuedAction): Promise<void>
  pending(): Promise<QueuedEntry[]>
  remove(id: string): Promise<void>
  fail(id: string, reason: string): Promise<void>
  failed(): Promise<FailedEntry[]>
  forgetFailed(id: string): Promise<void>
}
