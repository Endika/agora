export interface AttachedImage {
  id: string
  path: string
  thumbPath: string
  width: number
  height: number
  bytes: number
}

/** A picked file, already compressed and ready to upload. */
export interface PreparedUpload {
  full: Blob
  thumb: Blob
  width: number
  height: number
  bytes: number
  previewUrl: string
}

/**
 * Turning a file from someone's camera roll into two objects in Storage and a row on the proposal.
 * A port because all of it is browser and network: canvas, magic bytes, buckets.
 */
export interface ProposalImages {
  /** Compress and strip metadata locally. Throws with code IMAGE_TOO_LARGE or IMAGE_TYPE. */
  prepare(file: Blob): Promise<PreparedUpload>
  /** Upload both sizes and attach the row. */
  attach(input: { slug: string; proposalId: string; prepared: PreparedUpload }): Promise<void>
  /** The URL to show for a stored path. */
  urlFor(path: string): string
}
