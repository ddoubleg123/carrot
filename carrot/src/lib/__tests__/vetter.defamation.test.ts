import { vetSource } from '../discovery/vetter'

const deepseekResponse = (payload: Record<string, unknown>) => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify(payload)
        }
      }
    ]
  })
})

describe('vetSource defamation & PII guards', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('rejects sources containing PII', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      deepseekResponse({
        isUseful: true,
        relevanceScore: 0.7,
        qualityScore: 80,
        whyItMatters: 'Contact them at reporter@example.com',
        facts: [],
        quotes: [],
        contested: null,
        provenance: ['https://source.example.com']
      })
    ) as any

    await expect(
      vetSource({
        topic: 'Test Topic',
        aliases: [],
        url: 'https://origin.example.com',
        text: 'Body'
      })
    ).rejects.toThrow(/pii_detected/)
  })

  it('rejects criminal allegations without Tier1/Tier2 anchors', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      deepseekResponse({
        isUseful: true,
        relevanceScore: 0.8,
        qualityScore: 85,
        whyItMatters: 'Important context',
        facts: [
          {
            label: 'Allegation',
            value: 'The private individual was arrested for fraud.',
            citation: 'https://smallblog.example.com/post'
          }
        ],
        quotes: [],
        contested: null,
        provenance: ['https://smallblog.example.com/post']
      })
    ) as any

    await expect(
      vetSource({
        topic: 'Topic',
        aliases: [],
        url: 'https://origin.example.com',
        text: 'Text'
      })
    ).rejects.toThrow(/defamation_guard/)
  })

  it('allows criminal allegations when Tier1/Tier2 source present', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      deepseekResponse({
        isUseful: true,
        relevanceScore: 0.8,
        qualityScore: 85,
        whyItMatters: 'Important context',
        facts: [
          {
            label: 'Allegation',
            value: 'The private individual was arrested for fraud according to official filings.',
            citation: 'https://www.reuters.com/article'
          }
        ],
        quotes: [],
        contested: null,
        provenance: ['https://www.reuters.com/article']
      })
    ) as any

    await expect(
      vetSource({
        topic: 'Topic',
        aliases: [],
        url: 'https://origin.example.com',
        text: 'Text'
      })
    ).resolves.toMatchObject({
      relevanceScore: expect.any(Number),
      qualityScore: expect.any(Number)
    })
  })
})

