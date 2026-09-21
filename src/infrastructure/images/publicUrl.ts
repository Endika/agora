export const BUCKET = 'agora-images'

/**
 * What `storage.getPublicUrl` returns, without the client: a public object URL is pure string
 * concatenation. Keeping it here is what lets `urlFor` stay synchronous while the Supabase module
 * is downloaded lazily — `ImageGallery` calls it during render.
 *
 * The path is interpolated as-is, where `getPublicUrl` would percent-encode it. Every path the app
 * stores is `<slug>/<uuid>/<uuidv7>.webp`, so there is nothing to encode; a caller that ever passes
 * something outside that alphabet has to encode it first.
 */
export function publicUrl(projectUrl: string, path: string): string {
  return `${projectUrl.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${path}`
}
