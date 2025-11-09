import { normaliseArray, vetSource } from '../discovery/vetter'

describe('vetter helpers', () => {
  describe('normaliseArray', () => {
    test('filters falsy entries and maps values', () => {
      const input = [
        { label: 'A', value: '1' },
        null,
        { label: 'B', value: '2' },
        undefined
      ]

      const result = normaliseArray(input, (entry) => {
        if (!entry) return null
        return entry.value
      })

      expect(result).toEqual(['1', '2'])
    })
  })

  describe('vetSource', () => {
    const originalFetch = global.fetch
    const ORIGINAL_KEY = process.env.DEEPSEEK_API_KEY

    beforeEach(() => {
      process.env.DEEPSEEK_API_KEY = 'test-key'
    })

    afterEach(() => {
      jest.resetAllMocks()
      if (ORIGINAL_KEY === undefined) {
        delete process.env.DEEPSEEK_API_KEY
      } else {
        process.env.DEEPSEEK_API_KEY = ORIGINAL_KEY
      }
      global.fetch = originalFetch
    })

    test('normalises DeepSeek response payload', async () => {
      const mockedResponse = {
        choices: [
          {
            message: {
              content: `\n\n\`\`\`json\n{\n  "isUseful": true,\n  "relevanceScore": 0.92,\n  "qualityScore": 88,\n  "whyItMatters": "  Key insight  ",\n  "facts": [\n    { "label": " Fact A ", "value": " Value A ", "citation": " https://source.test/a " },\n    null\n  ],\n  "quotes": [\n    { "text": " Quote text ", "speaker": " Speaker ", "citation": " https://source.test/a#quote " },\n    { "text": 123 }\n  ],\n  "provenance": [" https://source.test/a "],\n  "contested": {\n    "note": "  contested note  ",\n    "supporting": " https://supporting.test ",\n    "counter": " https://counter.test ",\n    "claim": " Claim text "\n  }\n}\n\`\`\``
            }
          }
        ]
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockedResponse),
        text: () => Promise.resolve('')
      }) as any

      const result = await vetSource({
        topic: 'Test Topic',
        aliases: ['Alias'],
        url: 'https://source.test/a',
        text: 'Sample article text with more than two hundred words repeated. '.repeat(10),
        contestedClaims: ['Claim text']
      })

      expect(result.isUseful).toBe(true)
      expect(result.relevanceScore).toBeCloseTo(0.92)
      expect(result.qualityScore).toBe(88)
      expect(result.whyItMatters).toBe('Key insight')
      expect(result.facts).toEqual([
        {
          label: 'Fact A',
          value: 'Value A',
          citation: 'https://source.test/a'
        }
      ])
      expect(result.quotes).toEqual([
        {
          text: 'Quote text',
          speaker: 'Speaker',
          citation: 'https://source.test/a#quote'
        }
      ])
      expect(result.provenance).toEqual(['https://source.test/a'])
      expect(result.contested).toEqual({
        note: 'contested note',
        supporting: 'https://supporting.test',
        counter: 'https://counter.test',
        claim: 'Claim text'
      })
    })

    test('falls back to source URL when provenance missing', async () => {
      const mockedResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                isUseful: true,
                relevanceScore: 0.9,
                qualityScore: 80,
                whyItMatters: 'Insight',
                facts: [],
                quotes: [],
                contested: null
              })
            }
          }
        ]
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockedResponse),
        text: () => Promise.resolve('')
      }) as any

      const result = await vetSource({
        topic: 'Test Topic',
        aliases: [],
        url: 'https://source.test/missing',
        text: 'Sufficient content '.repeat(20)
      })

      expect(result.provenance).toEqual(['https://source.test/missing'])
    })
  })
})
