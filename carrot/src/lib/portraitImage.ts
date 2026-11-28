import { youtubeIdFromText } from '@/lib/youtube'

export function listedImage(value?: string | null): string {
  if (!value) return ''
  try {
    const parsed = JSON.parse(value)
    const first = Array.isArray(parsed) ? parsed.find((item) => typeof item === 'string' && item.trim()) : ''
    return typeof first === 'string' ? first : ''
  } catch {
    return ''
  }
}

export function postCardImage(post: { thumbnailUrl?: string | null; imageUrls?: string | null; content?: string | null }): string {
  const thumb = post.thumbnailUrl?.trim()
  if (thumb) return thumb
  const listed = listedImage(post.imageUrls)
  if (listed) return listed
  const video = youtubeIdFromText(post.content)
  return video ? `https://i.ytimg.com/vi/${video}/hqdefault.jpg` : ''
}
