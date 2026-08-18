/** The link people share. Whoever opens it joins the agora, which is why the copy says so. */
export function agoraLink(slug: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/g/${slug}`
}
