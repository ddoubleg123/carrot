import type { RailItem } from '@/lib/live/now'

export interface RecentVideo {
  videoId: string
  channelId: string
  channel: string
  title: string
  thumb: string
}

const TEN_MINUTES = 10 * 60 * 1000
let cache: { at: number; key: string; videos: RecentVideo[] } | null = null

export async function recentVideos(items: RailItem[]): Promise<RecentVideo[]> {
  const youtube = items.filter((item) => item.platform === 'youtube' && item.channelId)
  const channels = [...youtube.filter((item) => item.presence === 'live'), ...youtube.filter((item) => item.presence !== 'live')].slice(0, 12)
  const key = channels.map((item) => item.channelId).join(',')
  if (cache && cache.key === key && Date.now() - cache.at < TEN_MINUTES) return cache.videos
  const rows = await Promise.all(channels.map((item) => channelVideos(item)))
  const videos = rows.flat().slice(0, 24)
  cache = { at: Date.now(), key, videos }
  return videos
}

async function channelVideos(item: RailItem): Promise<RecentVideo[]> {
  const channelId = item.channelId
  if (!channelId) return []
  try {
    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/atom+xml' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    })
    if (!response.ok) return []
    const xml = await response.text()
    const entries = xml.split('<entry>').slice(1, 4)
    return entries.flatMap((entry) => {
      const videoId = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1]
      if (!videoId || videoId === item.playId) return []
      const title = decode(entry.match(/<title>([^<]*)<\/title>/)?.[1] || item.name)
      return [{
        videoId,
        channelId,
        channel: item.name,
        title,
        thumb: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
      }]
    }).slice(0, 1)
  } catch {
    return []
  }
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
}
