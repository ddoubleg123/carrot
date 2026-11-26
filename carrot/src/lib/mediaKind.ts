export type MediaKind = 'text' | 'image' | 'video' | 'audio' | 'pdf' | 'article'

type MediaRow = {
  videoUrl?: string | null
  cfUid?: string | null
  cfPlaybackUrlHls?: string | null
  imageUrls?: string[] | string | null
  gifUrl?: string | null
  audioUrl?: string | null
  content?: string | null
}

function textOf(value: MediaRow['imageUrls']): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(' ')
  return typeof value === 'string' ? value : ''
}

/** What the slate uses to keep two of a kind from stacking. */
export function mediaKind(post: MediaRow): MediaKind {
  const video = post.videoUrl || post.cfUid || post.cfPlaybackUrlHls
  if (video) return 'video'
  if (post.audioUrl) return 'audio'
  const content = post.content || ''
  if (/^kind:\s*quote\b/im.test(content)) return 'image'
  if (/\.pdf(\?|$)/i.test(content)) return 'pdf'
  if (/https?:\/\//i.test(content)) return 'article'
  const images = textOf(post.imageUrls)
  if (images || post.gifUrl) return 'image'
  return 'text'
}
