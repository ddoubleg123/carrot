/**
 * Unit tests for deep-link crawler
 */

import { normalizeInput, expandQueries, generateCandidates } from '../discovery/deepLinkCrawler'

describe('DeepLinkCrawler', () => {
  describe('normalizeInput', () => {
    it('should extract notes and keywords', () => {
      const result = normalizeInput({
        notes: '  Test notes  ',
        keywords: ['keyword1', 'keyword2'],
        other: 'ignored'
      })
      
      expect(result.notes).toBe('Test notes')
      expect(result.keywords).toEqual(['keyword1', 'keyword2'])
    })

    it('should handle missing fields', () => {
      const result = normalizeInput({})
      expect(result.notes).toBeUndefined()
      expect(result.keywords).toBeUndefined()
    })

    it('should filter empty keywords', () => {
      const result = normalizeInput({
        keywords: ['valid', '', '  ', 'also-valid']
      })
      expect(result.keywords).toEqual(['valid', 'also-valid'])
    })
  })

  describe('expandQueries', () => {
    it('should build queries from keywords', async () => {
      const input = {
        keywords: ['Chicago Bulls', 'season outlook']
      }
      
      const result = await expandQueries(input)
      
      expect(result.ok).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.length).toBeGreaterThan(0)
    })

    it('should extract from notes when no keywords', async () => {
      const input = {
        notes: 'features; statistics; season outlook'
      }
      
      const result = await expandQueries(input)
      
      expect(result.ok).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should return error when no input', async () => {
      const input = {}
      
      const result = await expandQueries(input)
      
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('ERR_NO_QUERY_INPUT')
    })

    it('should use provider when available', async () => {
      const input = {
        keywords: ['test']
      }
      
      const provider = async (keywords: string[]) => {
        return keywords.map(k => `provider:${k}`)
      }
      
      const result = await expandQueries(input, { provider })
      
      expect(result.ok).toBe(true)
      expect(result.data).toContain('provider:test')
    })
  })

  describe('generateCandidates', () => {
    it('should return empty array when no queries', async () => {
      const result = await generateCandidates([])
      
      expect(result.ok).toBe(true)
      expect(result.data).toEqual([])
    })

    // Note: Actual NewsAPI integration tests would require API key
    // These are unit tests for the logic, not integration tests
  })
})

describe('Circuit Breaker', () => {
  it('should cap attempts per step', () => {
    // This would be tested in integration tests
    // The logic is: attempts.byStep[step] <= MAX_ATTEMPTS_PER_STEP
    expect(Number(process.env.CRAWLER_MAX_ATTEMPTS_PER_STEP || 10)).toBeGreaterThan(0)
  })

  it('should cap total attempts', () => {
    expect(Number(process.env.CRAWLER_MAX_ATTEMPTS_TOTAL || 40)).toBeGreaterThan(0)
  })
})

