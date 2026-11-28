import type { LivePlatform } from '@/lib/live/streams'

/** The site hostname Twitch requires, without a port. */
export function embedParent(host: string): string {
  const bare = host.split(':')[0].trim().toLowerCase()
  return bare || 'localhost'
}

/**
 * Official player URL for a public stream link.
 * Returns null when the platform does not give Carrot an embeddable live id.
 */
export function embedSrc(url: string, parent: string): string | null {
  const channel = url.match(/youtube\.com\/channel\/(UC[\w-]{22})/i)
  if (channel) {
    return `https://www.youtube-nocookie.com/embed/live_stream?channel=${channel[1]}&autoplay=1&mute=1`
  }
  const video = url.match(/youtube\.com\/watch\?v=([\w-]{11})/i) || url.match(/youtu\.be\/([\w-]{11})/i)
  if (video) return `https://www.youtube-nocookie.com/embed/${video[1]}?autoplay=1&mute=1`
  const twitch = url.match(/twitch\.tv\/([A-Za-z0-9_]+)/i)
  if (twitch) {
    return `https://player.twitch.tv/?channel=${twitch[1]}&parent=${encodeURIComponent(embedParent(parent))}&muted=true&autoplay=true`
  }
  const kick = url.match(/kick\.com\/([A-Za-z0-9_]+)/i)
  if (kick) return `https://player.kick.com/${kick[1]}`
  const rumble = url.match(/rumble\.com\/embed\/([A-Za-z0-9]+)/i)
  if (rumble) return `https://rumble.com/embed/${rumble[1]}/`
  return null
}

export function platformFromUrl(url: string): LivePlatform | null {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/twitch\.tv/i.test(url)) return 'twitch'
  if (/kick\.com/i.test(url)) return 'kick'
  if (/rumble\.com/i.test(url)) return 'rumble'
  if (/facebook\.com|fb\.watch/i.test(url)) return 'facebook'
  return null
}
