export const READY_TYPES = ['text', 'image', 'clip', 'video', 'article', 'audio'] as const

export type ReadyType = (typeof READY_TYPES)[number]

export type ReadyGroup = { id: string; name: string }

export type ReadyItem = {
  id: string
  groupId: string
  at: string
  type: ReadyType
  title: string
  url: string
}

export const READY_LABELS: Record<ReadyType, string> = {
  text: 'Text',
  image: 'Image',
  clip: 'Clip',
  video: 'Video',
  article: 'Article',
  audio: 'Audio'
}

type ReadyRow = {
  videoUrl?: string | null
  videoPath?: string | null
  audioUrl?: string | null
  imageUrls?: string | null
  gifUrl?: string | null
  thumbnailUrl?: string | null
  content?: string | null
}

/** The kind of post a group has saved. A stored clip is a clip. A linked video is a video. */
export function readyType(post: ReadyRow): ReadyType {
  if (post.audioUrl) return 'audio'
  if (post.videoUrl || post.videoPath) return 'clip'
  const content = post.content || ''
  if (/^kind:\s*quote\b/im.test(content)) return 'image'
  if (/youtube\.com|youtu\.be|twitch\.tv|kick\.com|rumble\.com/i.test(content)) return 'video'
  if (/https?:\/\//i.test(content)) return 'article'
  if (post.imageUrls || post.gifUrl || post.thumbnailUrl) return 'image'
  return 'text'
}

export function readyTitle(content?: string | null): string {
  const line = String(content || '')
    .split('\n')
    .map((part) => part.trim())
    .filter((part) => part && !/^\/patch\/\S+$/.test(part) && !/^https?:\/\//.test(part) && !/^(title|when|from|image|kind|source):/i.test(part))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return line.slice(0, 280)
}

export function readyLink(content?: string | null): string {
  const raw = String(content || '').match(/https?:\/\/[^\s)]+/)?.[0] || ''
  if (!raw) return ''
  try {
    const url = new URL(raw)
    if (url.searchParams.has('token') || url.hostname.includes('firebasestorage')) url.search = ''
    return url.toString()
  } catch {
    return ''
  }
}
