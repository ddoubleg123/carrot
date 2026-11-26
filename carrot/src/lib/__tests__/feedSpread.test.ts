import { spreadSlate } from '../feedTimeline'

describe('home keeps outlets and subjects apart', () => {
  it('does not open with two posts from one outlet', () => {
    const posts = [
      { id: 'golf', userId: 'a', bucket: 'golf-links', lane: 'sport', outlet: 'bbc', media: 'article' },
      { id: 'race', userId: 'b', bucket: 'race-day', lane: 'sport', outlet: 'bbc', media: 'article' },
      { id: 'world', userId: 'c', bucket: 'world', lane: 'world', outlet: 'reuters', media: 'article' },
      { id: 'clip', userId: 'd', bucket: 'science', lane: 'science', outlet: '', media: 'video' }
    ]
    const slate = spreadSlate(posts, { media: 2, bucket: 2 })
    expect(slate.slice(0, 3).map((post) => post.id)).toEqual(['golf', 'world', 'clip'])
  })
})
