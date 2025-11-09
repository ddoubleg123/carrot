import { DeduplicationChecker, SimHash } from '../discovery/deduplication'

jest.mock('../discovery/canonicalize', () => ({
  canonicalize: jest.fn(async (url: string) => {
    const cleanUrl = url.replace(/\/+$/, '')
    const domain = new URL(url).hostname
    return {
      canonicalUrl: cleanUrl,
      finalDomain: domain
    }
  })
}))

describe('DeduplicationChecker', () => {
  const checker = new DeduplicationChecker()

  afterEach(() => {
    checker.clearGroup('group-a')
    checker.clearGroup('group-b')
    checker.clearGroup('group-c')
  })

  test('SimHash hamming distance is zero for identical text', () => {
    const text = 'Chicago Bulls win another championship season'
    const hashA = SimHash.generate(text)
    const hashB = SimHash.generate(text)

    expect(SimHash.hammingDistance(hashA, hashB)).toBe(0)
  })

  test('detects exact canonical duplicates (Tier A)', async () => {
    const url = 'https://example.com/story'
    const title = 'Example Story'
    const content = 'Unique content with lots of Chicago Bulls references '.repeat(5)
    const domain = 'example.com'

    const firstResult = await checker.checkDuplicate('group-a', url, title, content, domain)
    expect(firstResult.isDuplicate).toBe(false)

    const secondResult = await checker.checkDuplicate('group-a', url, title, content, domain)
    expect(secondResult).toMatchObject({ isDuplicate: true, tier: 'A' })
  })

  test('detects near-duplicate content via SimHash (Tier B)', async () => {
    const baseUrl = 'https://news.test/item'
    const title = 'Breaking News Story'
    const content = 'This is a long article describing events in detail repeatedly. '.repeat(6)
    const similarContent = content.replace('events', 'events unfolding')

    const first = await checker.checkDuplicate('group-b', baseUrl, title, content, 'news.test')
    expect(first.isDuplicate).toBe(false)

    const second = await checker.checkDuplicate('group-b', `${baseUrl}-followup`, title, similarContent, 'news.test')
    expect(second).toMatchObject({ isDuplicate: true, tier: 'B' })
  })

  test('detects high title similarity on same domain (Tier C)', async () => {
    const titleA = 'Chicago Bulls secure playoff berth after dramatic win'
    const titleB = 'Chicago Bulls secure playoff berth after a dramatic win'

    const first = await checker.checkDuplicate('group-c', 'https://sports.test/a', titleA, 'Content A '.repeat(5), 'sports.test')
    expect(first.isDuplicate).toBe(false)

    const second = await checker.checkDuplicate('group-c', 'https://sports.test/b', titleB, 'Content B '.repeat(5), 'sports.test')
    expect(second).toMatchObject({ isDuplicate: true, tier: 'C' })
  })
})
