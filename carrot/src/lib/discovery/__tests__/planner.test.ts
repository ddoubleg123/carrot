/**
 * Unit tests for discovery planner
 */

import { generateFallbackDomainPack, seedFrontierFromPlan, normaliseSeedCandidate } from '../planner'
import type { DiscoveryPlan, PlannerSeedCandidate } from '../planner'

describe('Discovery Planner', () => {
  describe('generateFallbackDomainPack', () => {
    it('should generate basketball-specific seeds for Chicago Bulls', () => {
      const seeds = generateFallbackDomainPack('Chicago Bulls', [])
      expect(seeds.length).toBeGreaterThan(0)
      expect(seeds.some(s => s.url.includes('nba.com'))).toBe(true)
      expect(seeds.some(s => s.url.includes('espn.com'))).toBe(true)
    })

    it('should generate generic seeds for non-basketball topics', () => {
      const seeds = generateFallbackDomainPack('Climate Change', [])
      expect(seeds.length).toBeGreaterThan(0)
      expect(seeds.some(s => s.url.includes('wikipedia.org'))).toBe(true)
    })
  })

  describe('normaliseSeedCandidate', () => {
    it('should normalize a valid seed candidate', () => {
      const seed: PlannerSeedCandidate = {
        url: 'https://example.com/article',
        titleGuess: 'Test Article',
        category: 'media',
        angle: 'Test angle',
        sourceType: 'media',
        stance: 'establishment'
      }
      
      const normalized = normaliseSeedCandidate(seed)
      expect(normalized.url).toBe('https://example.com/article')
      expect(normalized.category).toBe('media')
    })

    it('should throw error for missing URL', () => {
      const seed = {
        titleGuess: 'Test',
        category: 'media',
        angle: 'Test'
      } as any
      
      expect(() => normaliseSeedCandidate(seed)).toThrow('Invalid seed candidate: missing URL')
    })
  })

  describe('seedFrontierFromPlan', () => {
    it('should never abort even with low diversity', async () => {
      const mockPlan: DiscoveryPlan = {
        topic: 'Test Topic',
        aliases: [],
        generatedAt: new Date().toISOString(),
        mustTerms: ['test'],
        shouldTerms: [],
        disallowTerms: [],
        queryAngles: [],
        controversyAngles: [],
        historyAngles: [],
        coverageTargets: {
          controversyRatio: 0.5,
          minNonMediaPerContested: 1,
          maxPerDomain: 2
        },
        queries: {},
        contentQueries: {
          wikipedia: [],
          news: [],
          official: [],
          longform: [],
          data: []
        },
        seedCandidates: [
          // Only 3 seeds from same domain - should still proceed
          {
            url: 'https://example.com/article1',
            category: 'media',
            angle: 'Test',
            sourceType: 'media'
          },
          {
            url: 'https://example.com/article2',
            category: 'media',
            angle: 'Test',
            sourceType: 'media'
          },
          {
            url: 'https://example.com/article3',
            category: 'media',
            angle: 'Test',
            sourceType: 'media'
          }
        ]
      }

      // Should not throw - planner should add fallback seeds
      await expect(
        seedFrontierFromPlan('test-patch-id', mockPlan)
      ).resolves.not.toThrow()
    })
  })
})

