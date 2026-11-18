export interface XClip {
  handle: string
  url: string
  poster: string
  video: string
  duration: string
  note: string
}

export interface XQuote {
  name: string
  handle: string
  date: string
  text: string
  url: string
  clips: XClip[]
}

export interface XPostView {
  name: string
  handle: string
  avatar: string
  date: string
  text: string
  url: string
  photos: string[]
  clips: XClip[]
  quote: XQuote | null
}

const cache = new Map<string, { until: number; tweet: any }>()

function statusRef(raw: string): { user: string; id: string } | null {
  try {
    const url = new URL(raw.trim())
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host !== 'x.com' && host !== 'twitter.com' && host !== 'mobile.twitter.com' && host !== 'mobile.x.com') return null
    const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/)
    if (!match || /^(i|intent|search|explore|home|share)$/i.test(match[1])) return null
    return { user: match[1], id: match[2] }
  } catch {
    return null
  }
}

function linksIn(text: string): Array<{ user: string; id: string }> {
  const found: Array<{ user: string; id: string }> = []
  const seen = new Set<string>()
  for (const match of text.matchAll(/https?:\/\/(?:www\.)?(?:mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,30})\/status\/(\d+)/gi)) {
    if (seen.has(match[2]) || /^(i|intent|search|explore|home|share)$/i.test(match[1])) continue
    seen.add(match[2])
    found.push({ user: match[1], id: match[2] })
  }
  return found.slice(0, 4)
}

export function plainPost(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function postedOn(raw: string): string {
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${parsed.getUTCDate()} ${months[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`
}

function clock(seconds: number): string {
  const total = Math.round(seconds)
  if (!Number.isFinite(total) || total <= 0) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remain = total % 60
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`
  return `${minutes}:${String(remain).padStart(2, '0')}`
}

async function loadTweet(user: string, id: string): Promise<any | null> {
  const cached = cache.get(id)
  if (cached && cached.until > Date.now()) return cached.tweet
  const response = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(user)}/status/${id}`, {
    headers: { 'User-Agent': 'CarrotLearn/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000)
  }).catch(() => null)
  const data = await response?.json().catch(() => null)
  const tweet = data?.tweet
  if (!response?.ok || !tweet) return null
  cache.set(id, { until: Date.now() + 10 * 60 * 1000, tweet })
  return tweet
}

function clipsFrom(tweet: any, note: string): XClip[] {
  const videos = Array.isArray(tweet?.media?.videos) ? tweet.media.videos : []
  const handle = typeof tweet?.author?.screen_name === 'string' ? tweet.author.screen_name : ''
  const url = typeof tweet?.url === 'string' ? tweet.url : handle && tweet?.id ? `https://x.com/${handle}/status/${tweet.id}` : ''
  return videos.slice(0, 2).flatMap((video: any) => {
    if (!video || typeof video.url !== 'string') return []
    return [{
      handle,
      url,
      poster: typeof video.thumbnail_url === 'string' ? video.thumbnail_url : '',
      video: video.url,
      duration: clock(Number(video.duration) || 0),
      note
    }]
  })
}

function viewFrom(tweet: any, clips: XClip[], quote: XQuote | null): XPostView | null {
  const handle = typeof tweet?.author?.screen_name === 'string' ? tweet.author.screen_name : ''
  const text = plainPost(typeof tweet?.text === 'string' ? tweet.text : '')
  if (!handle || !text) return null
  return {
    name: typeof tweet?.author?.name === 'string' ? tweet.author.name : handle,
    handle,
    avatar: typeof tweet?.author?.avatar_url === 'string' ? tweet.author.avatar_url : '',
    date: postedOn(typeof tweet?.created_at === 'string' ? tweet.created_at : ''),
    text,
    url: typeof tweet?.url === 'string' ? tweet.url : `https://x.com/${handle}/status/${tweet.id}`,
    photos: (Array.isArray(tweet?.media?.photos) ? tweet.media.photos : []).flatMap((photo: any) => typeof photo?.url === 'string' ? [photo.url] : []).slice(0, 4),
    clips,
    quote
  }
}

export async function readXPost(raw: string): Promise<XPostView | null> {
  const target = statusRef(raw)
  if (!target) return null
  const tweet = await loadTweet(target.user, target.id)
  if (!tweet) return null
  const text = typeof tweet.text === 'string' ? tweet.text : ''
  const quoteTweet = tweet.quote
  const quoteId = quoteTweet?.id ? String(quoteTweet.id) : ''
  const linked = linksIn(text).filter((item) => item.id !== target.id && item.id !== quoteId)
  const clips = (await Promise.all(linked.map(async (item) => {
    const linkedTweet = await loadTweet(item.user, item.id)
    return linkedTweet ? clipsFrom(linkedTweet, 'linked in this post').slice(0, 1) : []
  }))).flat()
  const own = clips.length ? [] : clipsFrom(tweet, 'on this post').slice(0, 1)
  let quote: XQuote | null = null
  if (quoteTweet && typeof quoteTweet.text === 'string') {
    const quoteText = plainPost(quoteTweet.text)
    const quoteClips = clipsFrom(quoteTweet, 'the video on the quoted post').slice(0, 1)
    if (quoteText || quoteClips.length) {
      quote = {
        name: typeof quoteTweet.author?.name === 'string' ? quoteTweet.author.name : (quoteTweet.author?.screen_name || 'Post'),
        handle: typeof quoteTweet.author?.screen_name === 'string' ? quoteTweet.author.screen_name : '',
        date: postedOn(typeof quoteTweet.created_at === 'string' ? quoteTweet.created_at : ''),
        text: quoteText,
        url: typeof quoteTweet.url === 'string' ? quoteTweet.url : '',
        clips: quoteClips
      }
    }
  }
  return viewFrom(tweet, [...own, ...clips].slice(0, 4), quote)
}
