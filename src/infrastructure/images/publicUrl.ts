export const BUCKET = 'agora-images'

/**
 * What `storage.getPublicUrl` returns, without the client: a public object URL is pure string
 * concatenation. Keeping it here is what lets `urlFor` stay synchronous while the Supabase module
 * is downloaded lazily — `ImageGallery` calls it during render.
 */
export function publicUrl(projectUrl: string, path: string): string {
  return `${projectUrl.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${path}`
}
