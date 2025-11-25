/**
 * Unit tests for seen URL tracking
 */

import { canonicalizeUrlFast } from '../canonicalize'

describe('Seen URL Tracking', () => {
  describe('URL normalization', () => {
    it('should normalize URLs consistently', () => {
      const url1 = 'https://example.com/article?utm_source=test'
      const url2 = 'https://www.example.com/article'
      const url3 = 'https://example.com/article#section'
      
      const normalized1 = canonicalizeUrlFast(url1)
      const normalized2 = canonicalizeUrlFast(url2)
      const normalized3 = canonicalizeUrlFast(url3)
      
      // All should normalize to same canonical form
      expect(normalized1).toBe(normalized2)
      expect(normalized2).toBe(normalized3)
    })

    it('should handle malformed URLs gracefully', () => {
      expect(() => canonicalizeUrlFast('not-a-url')).not.toThrow()
      expect(canonicalizeUrlFast('not-a-url')).toBe('')
    })
  })
})

