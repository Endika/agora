import type { VoteValue } from '@/domain/entities/Proposal'
import type {
  BoardRepository,
  BoardSnapshot,
  Identity,
  NewProposal,
  PinResult,
} from '@/domain/repositories/BoardRepository'
import { identitySchema, parseBoard, pinResultSchema, versionSchema } from './schemas'
import type { AgoraClient } from './SupabaseClient'

/** Thin by design: one RPC per port method, validation at the boundary, no logic of its own. */
export class SupabaseBoardRepository implements BoardRepository {
  constructor(
    private readonly client: AgoraClient,
    private readonly deviceToken: () => string,
    private readonly slugGenerator: () => string,
  ) {}

  private async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.client.rpc(name, args)
    if (error) throw Object.assign(new Error(error.message), { code: error.code })
    return data
  }

  async createAgora(input: { name: string; creatorName: string; pin: string }): Promise<Identity> {
    // The slug is generated here, so a collision is ours to retry rather than the server's to solve.
    for (let attempt = 1; ; attempt++) {
      try {
        const data = await this.rpc('create_group', {
          p_name: input.name,
          p_slug: this.slugGenerator(),
          p_creator_name: input.creatorName,
          p_device_token: this.deviceToken(),
          p_pin: input.pin,
        })
        const parsed = identitySchema.parse(data)
        return { slug: parsed.slug, participantId: parsed.participant_id }
      } catch (error) {
        const code = (error as { code?: string }).code
        if (code !== 'PT409' || attempt >= 3) throw error
      }
    }
  }

  async joinAgora(input: { slug: string; name: string; pin: string }): Promise<Identity> {
    const parsed = identitySchema.parse(
      await this.rpc('join_group', {
        p_slug: input.slug,
        p_name: input.name,
        p_device_token: this.deviceToken(),
        p_pin: input.pin,
      }),
    )
    return { slug: parsed.slug, participantId: parsed.participant_id }
  }

  async recover(input: { slug: string; name: string; pin: string }): Promise<PinResult> {
    const parsed = pinResultSchema.parse(
      await this.rpc('recover_participant', {
        p_slug: input.slug,
        p_name: input.name,
        p_pin: input.pin,
        p_device_token: this.deviceToken(),
      }),
    )
    return parsed.ok
      ? { ok: true, identity: { slug: parsed.slug, participantId: parsed.participant_id } }
      : { ok: false, error: 'wrong_pin' }
  }

  async getVersion(slug: string): Promise<string> {
    return versionSchema.parse(await this.rpc('get_board_version', { p_slug: slug })).version
  }

  async getBoard(slug: string): Promise<BoardSnapshot> {
    return parseBoard(
      await this.rpc('get_board', { p_slug: slug, p_device_token: this.deviceToken() }),
    )
  }

  async getBoardSince(slug: string, since: string): Promise<BoardSnapshot> {
    return parseBoard(
      await this.rpc('get_board_since', {
        p_slug: slug,
        p_device_token: this.deviceToken(),
        p_since: since,
      }),
    )
  }

  async createProposal(input: { slug: string } & NewProposal): Promise<string> {
    const { slug, ...payload } = input
    const id = await this.rpc('create_proposal', {
      p_device_token: this.deviceToken(),
      p_slug: slug,
      p_payload: payload,
    })
    return String(id)
  }

  async updateProposal(input: { proposalId: string } & Partial<NewProposal>): Promise<void> {
    const { proposalId, ...payload } = input
    await this.rpc('update_proposal', {
      p_device_token: this.deviceToken(),
      p_proposal: proposalId,
      p_payload: payload,
    })
  }

  async castVote(input: { proposalId: string; round: number; value: VoteValue }): Promise<void> {
    await this.rpc('cast_vote', {
      p_device_token: this.deviceToken(),
      p_proposal: input.proposalId,
      p_round: input.round,
      p_value: input.value,
    })
  }

  async reopenProposal(proposalId: string): Promise<void> {
    await this.rpc('reopen_proposal', {
      p_device_token: this.deviceToken(),
      p_proposal: proposalId,
    })
  }

  async closeProposal(input: { proposalId: string; reason: string }): Promise<void> {
    await this.rpc('close_proposal', {
      p_device_token: this.deviceToken(),
      p_proposal: input.proposalId,
      p_reason: input.reason,
    })
  }

  async completeProposal(input: { proposalId: string; actualCents: number | null }): Promise<void> {
    await this.rpc('complete_proposal', {
      p_device_token: this.deviceToken(),
      p_proposal: input.proposalId,
      p_actual_cents: input.actualCents,
    })
  }

  async addThread(input: {
    threadId: string
    proposalId: string
    commentId: string
    body: string
  }): Promise<void> {
    await this.rpc('add_thread', {
      p_device_token: this.deviceToken(),
      p_thread: input.threadId,
      p_proposal: input.proposalId,
      p_comment: input.commentId,
      p_body: input.body,
    })
  }

  async addComment(input: { commentId: string; threadId: string; body: string }): Promise<void> {
    await this.rpc('add_comment', {
      p_device_token: this.deviceToken(),
      p_comment: input.commentId,
      p_thread: input.threadId,
      p_body: input.body,
    })
  }

  async setThreadResolved(input: { threadId: string; resolved: boolean }): Promise<void> {
    await this.rpc('set_thread_resolved', {
      p_device_token: this.deviceToken(),
      p_thread: input.threadId,
      p_resolved: input.resolved,
    })
  }

  async setExpenseShare(input: { proposalId: string; optedIn: boolean }): Promise<void> {
    await this.rpc('set_expense_share', {
      p_device_token: this.deviceToken(),
      p_proposal: input.proposalId,
      p_opted_in: input.optedIn,
    })
  }

  async addLiquidation(input: {
    id: string
    proposalId: string
    cents: number
    affects: string[]
  }): Promise<void> {
    await this.rpc('add_liquidation', {
      p_device_token: this.deviceToken(),
      p_id: input.id,
      p_proposal: input.proposalId,
      p_cents: input.cents,
      p_affects: input.affects,
    })
  }

  async setLiquidationSharePaid(input: {
    liquidationId: string
    participantId: string
    paid: boolean
  }): Promise<void> {
    await this.rpc('set_liquidation_share_paid', {
      p_device_token: this.deviceToken(),
      p_liquidation: input.liquidationId,
      p_participant: input.participantId,
      p_paid: input.paid,
    })
  }

  async attachImage(input: {
    id: string
    proposalId: string
    path: string
    thumbPath: string
    width: number
    height: number
    bytes: number
  }): Promise<void> {
    await this.rpc('attach_image', {
      p_device_token: this.deviceToken(),
      p_id: input.id,
      p_proposal: input.proposalId,
      p_path: input.path,
      p_thumb_path: input.thumbPath,
      p_width: input.width,
      p_height: input.height,
      p_bytes: input.bytes,
    })
  }
}
