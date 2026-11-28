import { dwellHours, searchHours, FEED_RANK_DEFAULTS } from '../feedRank'
import { readInterestText } from '../readInterest'
import { interestGroups } from '../interestCatalog'
import { buildTimeline, spreadSlate, placePol, isPolPost, rankHome, feedVisible } from '../feedTimeline'
import { mediaKind } from '../mediaKind'

describe('feed rank plan', () => {
  const groups = interestGroups()

  it('matches a group by name and keeps a narrower word', () => {
    const banks = readInterestText('central banks and payment', groups)
    expect(banks.matches.some((match) => match.id === 'money')).toBe(true)
    const measles = readInterestText('measles', groups)
    expect(measles.matches.length + measles.proposals.length).toBeGreaterThan(0)
  })

  it('caps dwell and treats a glance as a skip', () => {
    expect(dwellHours(500, FEED_RANK_DEFAULTS).kind).toBe('skip')
    expect(dwellHours(3000, FEED_RANK_DEFAULTS).kind).toBe('none')
    const long = dwellHours(90_000, FEED_RANK_DEFAULTS)
    expect(long.kind).toBe('dwell')
    expect(long.hours).toBe(FEED_RANK_DEFAULTS.dwell)
  })

  it('fades a search over seven days', () => {
    const now = Date.now()
    expect(searchHours([{ bucket: 'health', at: now }], 'health', 8, now)).toBe(8)
    expect(searchHours([{ bucket: 'health', at: now - 8 * 24 * 60 * 60 * 1000 }], 'health', 8, now)).toBe(0)
  })

  it('leaves your own posts off home unless someone else reposted one', () => {
    const posts = [
      { id: 'mine', userId: 'me', createdAt: '2025-10-01T12:00:00Z' },
      { id: 'theirs', userId: 'other', createdAt: '2026-11-25T12:00:00Z' },
      { id: 'shared', userId: 'me', repostedBy: 'other', createdAt: '2026-11-25T15:00:00Z' }
    ]
    const slate = buildTimeline(posts, { viewerId: 'me', following: ['other'], botIds: new Set() })
    expect(slate.map((post) => post.id)).toEqual(['shared', 'theirs'])
  })

  it('does not stack the same outlet or a run of sports', () => {
    const posts = [
      { id: 'golf', userId: 'a', bucket: 'golf-links', lane: 'sport', outlet: 'bbc', media: 'article' },
      { id: 'race', userId: 'b', bucket: 'race-day', lane: 'sport', outlet: 'bbc', media: 'article' },
      { id: 'world', userId: 'c', bucket: 'world', lane: 'world', outlet: 'reuters', media: 'article' },
      { id: 'clip', userId: 'd', bucket: 'science', lane: 'science', outlet: '', media: 'video' }
    ]
    const slate = spreadSlate(posts, { media: 2, bucket: 2 })
    expect(slate.map((post) => post.id)).toEqual(['golf', 'world', 'clip', 'race'])
  })

  it('does not stack three videos or three of one topic', () => {
    const posts = [1, 2, 3, 4].map((n) => ({
      userId: `u${n}`,
      bucket: n < 4 ? 'health' : 'money',
      media: n < 4 ? 'video' : 'text'
    }))
    const slate = spreadSlate(posts, { media: 2, bucket: 2 })
    expect(slate.map((post) => post.media).slice(0, 3)).toEqual(['video', 'video', 'text'])
  })

  it('puts an older interest ahead of newer sports you have pushed down', () => {
    const posts = [
      { id: 's1', userId: 'a', bucket: 'other-sports', media: 'article', createdAt: '2026-11-23T18:00:00Z' },
      { id: 's2', userId: 'b', bucket: 'other-sports', media: 'article', createdAt: '2026-11-23T17:00:00Z' },
      { id: 's3', userId: 'c', bucket: 'other-sports', media: 'article', createdAt: '2026-11-23T16:00:00Z' },
      { id: 's4', userId: 'd', bucket: 'other-sports', media: 'article', createdAt: '2026-11-23T15:00:00Z' },
      { id: 's5', userId: 'e', bucket: 'mlb-diamond', media: 'article', createdAt: '2026-11-23T14:00:00Z' },
      { id: 'i1', userId: 'f', bucket: 'israel', media: 'article', createdAt: '2026-11-20T12:00:00Z' },
      { id: 'i2', userId: 'g', bucket: 'israel', media: 'video', createdAt: '2026-11-21T12:00:00Z' }
    ]
    const hours: Record<string, number> = { 'other-sports': -10, 'mlb-diamond': -2, israel: 24 }
    const now = Date.parse('2026-11-23T20:00:00Z')
    const slate = rankHome(posts, { hoursFor: (post) => hours[String(post.bucket)] || 0, now })
    expect(slate.slice(0, 2).map((post) => post.bucket)).toEqual(['israel', 'israel'])
    expect(slate.slice(0, 2).map((post) => post.id)).toEqual(['i2', 'i1'])
    const seen = rankHome(posts, { hoursFor: (post) => hours[String(post.bucket)] || 0, seen: new Set(['i2']), now })
    expect(seen[0].id).toBe('i1')
    expect(seen.findIndex((post) => post.id === 'i2')).toBeGreaterThan(0)
    expect(seen.findIndex((post) => post.bucket === 'other-sports')).toBeGreaterThan(seen.findIndex((post) => post.id === 'i1'))
    const today = rankHome(posts, { hoursFor: (post) => hours[String(post.bucket)] || 0, seen: new Set(['s1', 'i1']), now })
    expect(today[0].id).toBe('i2')
    expect(today.findIndex((post) => post.id === 's1')).toBeLessThan(today.findIndex((post) => post.id === 'i1'))
  })

  it('does not open with two posts from an account you like', () => {
    const posts = [
      { id: 'quote', userId: 'finds', bucket: 'finds', media: 'text', createdAt: '2026-11-25T16:00:40Z' },
      { id: 'article', userId: 'finds', bucket: 'finds', media: 'article', createdAt: '2026-11-25T16:00:00Z' },
      { id: 'other', userId: 'world', bucket: 'world', media: 'article', createdAt: '2026-11-25T12:00:00Z' }
    ]
    const slate = rankHome(posts, {
      hoursFor: (post) => post.bucket === 'finds' ? 24 : 0,
      now: Date.parse('2026-11-25T16:01:00Z')
    })
    expect(slate[0].userId).toBe('finds')
    expect(slate[1].userId).not.toBe(slate[0].userId)
  })

  it('drops a quote that has no picture', () => {
    const posts = [
      { id: 'bare', content: 'kind: quote\nsource: The Hill\n\nA sentence with no picture attached.', thumbnailUrl: null },
      { id: 'shown', content: 'kind: quote\nsource: BBC Sport\nwhen: March 3, 2024\n\nThe West Baray alone is a man-made lake that stretches for nearly 8 kilometers.', thumbnailUrl: '/curator-thumbs/a.jpg' },
      { id: 'step', content: 'kind: quote\nsource: Food\n\nHeat the oven to 190C (170C fan)/375F/gas 5 and line two large baking trays.', thumbnailUrl: '/curator-thumbs/b.jpg' },
      { id: 'note', content: 'A normal note', thumbnailUrl: null }
    ]
    expect(feedVisible(posts).map((post) => post.id)).toEqual(['shown', 'note'])
  })

  it('shows one copy of a story and does not stack the same account', () => {
    const posts = [
      { id: 'a', userId: 'same', bucket: 'israel', media: 'image', thumbnailUrl: '/curator-thumbs/same.jpg', createdAt: '2026-11-23T18:00:00Z', content: 'Title: A ruling gives an old convention a new reading\nhttps://example.com/story' },
      { id: 'b', userId: 'same', bucket: 'israel', media: 'image', thumbnailUrl: '/curator-thumbs/same.jpg', createdAt: '2026-11-23T17:00:00Z', content: 'Title: A ruling gives an old convention a new reading\nhttps://example.com/story?ref=2' },
      { id: 'c', userId: 'other', bucket: 'world', media: 'video', createdAt: '2026-11-23T16:00:00Z' }
    ]
    const now = Date.parse('2026-11-23T20:00:00Z')
    const slate = rankHome(posts, { hoursFor: () => 24, now })
    expect(slate.filter((post) => post.thumbnailUrl === '/curator-thumbs/same.jpg')).toHaveLength(1)
    expect(slate.map((post) => post.id)).toEqual(['a', 'c'])
  })

  it('keeps pol watch off the home list unless a cadence is set', () => {
    const home = [{ userId: 'a' }, { userId: 'b' }]
    const pol = [{ userId: 'p' }]
    expect(placePol(home, pol, 0)).toHaveLength(2)
    expect(placePol(home, pol, 2)).toHaveLength(3)
    expect(isPolPost({ bucket: 'pol-watch' })).toBe(true)
    expect(isPolPost({ office: true })).toBe(true)
  })

  it('names the media from the fields already on a post', () => {
    expect(mediaKind({ videoUrl: 'https://example.com/a.mp4' })).toBe('video')
    expect(mediaKind({ audioUrl: 'https://example.com/a.mp3' })).toBe('audio')
    expect(mediaKind({ imageUrls: ['https://example.com/a.jpg'] })).toBe('image')
    expect(mediaKind({ content: 'Read https://example.com/paper.pdf' })).toBe('pdf')
    expect(mediaKind({ content: 'See https://example.com/story' })).toBe('article')
    expect(mediaKind({ content: 'Just a note' })).toBe('text')
  })
})
