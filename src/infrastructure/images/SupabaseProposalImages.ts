import { uuidv7 } from 'uuidv7'
import type { PreparedUpload, ProposalImages } from '@/domain/ports/ProposalImages'
import type { BoardRepository } from '@/domain/repositories/BoardRepository'
import { compressImage } from './compressImage'
import { BrowserImageCodec } from './BrowserImageCodec'
import type { AgoraClient } from '@/infrastructure/persistence/SupabaseClient'

const BUCKET = 'agora-images'

/** One year, immutable: the path carries a uuidv7 and never changes, so a device pays once per image. */
const CACHE_CONTROL = '31536000'

export class SupabaseProposalImages implements ProposalImages {
  constructor(
    private readonly client: AgoraClient,
    private readonly repo: BoardRepository,
  ) {}

  async prepare(file: Blob): Promise<PreparedUpload> {
    const { full, thumb } = await compressImage(file, BrowserImageCodec)
    return {
      full: full.blob,
      thumb: thumb.blob,
      width: full.width,
      height: full.height,
      bytes: full.blob.size,
      previewUrl: URL.createObjectURL(thumb.blob),
    }
  }

  async attach(input: {
    slug: string
    proposalId: string
    prepared: PreparedUpload
  }): Promise<void> {
    const id = uuidv7()
    const base = `${input.slug}/${input.proposalId}/${id}`
    const path = `${base}.webp`
    const thumbPath = `${base}-t.webp`
    const storage = this.client.storage.from(BUCKET)

    for (const [at, blob] of [
      [path, input.prepared.full],
      [thumbPath, input.prepared.thumb],
    ] as const) {
      const { error } = await storage.upload(at, blob, {
        contentType: 'image/webp',
        cacheControl: CACHE_CONTROL,
        upsert: false,
      })
      if (error) throw error
    }

    await this.repo.attachImage({
      id,
      proposalId: input.proposalId,
      path,
      thumbPath,
      width: input.prepared.width,
      height: input.prepared.height,
      bytes: input.prepared.bytes,
    })
  }

  urlFor(path: string): string {
    return this.client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }
}
