import { covers, searchWord } from '@/lib/learn/terms'

export interface PostHit {
  title: string
  url: string
  text: string
  image?: string
}

function queriesFor(tokens: string[], groupTitle: string): string[] {
  const named = tokens.filter((token) => token !== 'jfk').map((token) => searchWord(token))
  const lead = tokens.includes('jfk') ? 'JFK' : ''
  const group = groupTitle.trim()
  return [
    [group, lead, named[0]].filter(Boolean).join(' '),
    [group, lead, ...named.slice(0, 2)].filter(Boolean).join(' ')
  ].map((query) => query.trim()).filter((query, index, all) => query.length > 1 && all.indexOf(query) === index)
}

async function fetchPosts(query: string): Promise<any[] | null> {
  const endpoint = new URL('https://api.fxtwitter.com/2/search')
  endpoint.searchParams.set('q', query)
  endpoint.searchParams.set('feed', 'top')
  endpoint.searchParams.set('count', '10')
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'CarrotLearn/1.0 (group knowledge)', Accept: 'application/json' },
    signal: AbortSignal.timeout(6000)
  }).catch(() => null)
  const data = await response?.json().catch(() => null)
  if (data?.code === 200 && Array.isArray(data.results)) return data.results
  return null
}

function contentTitle(text: string): string {
  const line = text.replace(/https?:\/\/\S+/g, ' ').split(/(?<=[.!?])\s+/)[0] || text
  const clean = line.replace(/\s+/g, ' ').trim()
  if (clean.length < 24) return 'Post'
  return clean.length > 90 ? `${clean.slice(0, 87).trim()}…` : clean
}

function postText(post: any): string {
  const text = typeof post?.raw_text === 'string' && post.raw_text.trim() ? post.raw_text : post?.text
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
}

function postImage(post: any): string | undefined {
  const photos = post?.media?.photos || post?.tweet?.media?.photos
  const url = Array.isArray(photos) ? photos.find((photo: any) => typeof photo?.url === 'string')?.url : ''
  return typeof url === 'string' ? url : undefined
}

function hitFromTweet(tweet: any, fallbackUser = ''): PostHit | null {
  const text = postText(tweet)
  if (!tweet || text.length < 40) return null
  const handle = tweet.author?.screen_name || fallbackUser
  const url = typeof tweet.url === 'string' ? tweet.url : handle && tweet.id ? `https://x.com/${handle}/status/${tweet.id}` : ''
  if (!url) return null
  return { title: contentTitle(text), url, text, image: postImage(tweet) }
}

async function postsFromWeb(query: string): Promise<PostHit[]> {
  const endpoint = `https://search.yahoo.co.jp/realtime/search?p=${encodeURIComponent(query)}&ei=UTF-8`
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(12000)
  }).catch(() => null)
  if (!response?.ok) return []
  const html = await response.text()
  const targets: Array<{ user: string; id: string }> = []
  const seen = new Set<string>()
  for (const match of html.matchAll(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,30})\/status\/(\d{8,})/g)) {
    if (seen.has(match[2]) || /^(i|intent|search|explore|home|share)$/i.test(match[1])) continue
    seen.add(match[2])
    targets.push({ user: match[1], id: match[2] })
    if (targets.length >= 4) break
  }
  const loaded = await Promise.all(targets.map(async (target) => {
    const response = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(target.user)}/status/${target.id}`, {
      headers: { 'User-Agent': 'CarrotLearn/1.0 (group knowledge)', Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    }).catch(() => null)
    const data = await response?.json().catch(() => null)
    const tweet = data?.tweet || data?.status
    return [hitFromTweet(tweet?.quote), hitFromTweet(tweet, target.user)].filter((post): post is PostHit => !!post)
  }))
  return loaded.flat()
}

function matching(posts: PostHit[], tokens: string[], groupTitle: string): PostHit[] {
  const group = groupTitle.trim().toLowerCase()
  const found: Array<{ post: PostHit; hits: number }> = []
  const seen = new Set<string>()
  for (const post of posts) {
    if (!post.url || seen.has(post.url)) continue
    const hay = `${post.title} ${post.text}`
    const hits = tokens.filter((token) => covers(hay, [token])).length
    if (hits < Math.min(2, tokens.length)) continue
    if (tokens.length < 2 && group && !covers(hay, [group])) continue
    seen.add(post.url)
    found.push({ post, hits })
  }
  return found
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map((item) => item.post)
}

export async function searchPosts(tokens: string[], groupTitle: string): Promise<PostHit[]> {
  if (tokens.length === 0) return []
  for (const query of queriesFor(tokens, groupTitle)) {
    const webPromise = postsFromWeb(query)
    const direct = await fetchPosts(query)
    const fromDirect = matching((direct || []).flatMap((post) => {
      const text = postText(post)
      const url = typeof post?.url === 'string' ? post.url : ''
      if (!url || text.length < 40) return []
      return [{ title: contentTitle(text), url, text, image: postImage(post) }]
    }), tokens, groupTitle)
    if (fromDirect.length) return fromDirect
    const fromWeb = matching(await webPromise, tokens, groupTitle)
    if (fromWeb.length) return fromWeb
  }
  return []
}
