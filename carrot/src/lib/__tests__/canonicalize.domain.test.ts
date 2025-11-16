/**
 * Unit tests for getDomainFromUrl helper function
 */

import { getDomainFromUrl } from '../discovery/canonicalize'

describe('getDomainFromUrl', () => {
  describe('happy path', () => {
    it('should extract domain from https URL', () => {
      const url = 'https://example.com/article'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('example.com')
    })

    it('should extract domain from http URL', () => {
      const url = 'http://example.com/article'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('example.com')
    })

    it('should strip www prefix', () => {
      const url = 'https://www.example.com/article'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('example.com')
    })

    it('should handle www with subdomain', () => {
      const url = 'https://www.subdomain.example.com/article'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('subdomain.example.com')
    })

    it('should normalize to lowercase', () => {
      const url = 'https://EXAMPLE.COM/article'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('example.com')
    })

    it('should handle URLs with query parameters', () => {
      const url = 'https://example.com/article?foo=bar&baz=qux'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('example.com')
    })

    it('should handle URLs with fragments', () => {
      const url = 'https://example.com/article#section'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('example.com')
    })

    it('should handle URLs with ports', () => {
      const url = 'https://example.com:8080/article'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('example.com')
    })

    it('should handle relative URLs by assuming https', () => {
      const url = '//example.com/article'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('example.com')
    })

    it('should handle URLs without protocol by assuming https', () => {
      const url = 'example.com/article'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('example.com')
    })
  })

  describe('edge cases', () => {
    it('should return null for null input', () => {
      const domain = getDomainFromUrl(null)
      expect(domain).toBeNull()
    })

    it('should return null for undefined input', () => {
      const domain = getDomainFromUrl(undefined)
      expect(domain).toBeNull()
    })

    it('should return null for empty string', () => {
      const domain = getDomainFromUrl('')
      expect(domain).toBeNull()
    })

    it('should return null for invalid URL', () => {
      const url = 'not-a-valid-url'
      const domain = getDomainFromUrl(url)
      expect(domain).toBeNull()
    })

    it('should return null for malformed URL', () => {
      const url = 'https://[invalid'
      const domain = getDomainFromUrl(url)
      expect(domain).toBeNull()
    })

    it('should handle URLs with only whitespace', () => {
      const url = '   '
      const domain = getDomainFromUrl(url)
      expect(domain).toBeNull()
    })

    it('should trim whitespace from URLs', () => {
      const url = '  https://example.com/article  '
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('example.com')
    })
  })

  describe('real-world examples', () => {
    it('should handle Wikipedia URLs', () => {
      const url = 'https://en.wikipedia.org/wiki/Chicago_Bulls'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('en.wikipedia.org')
    })

    it('should handle news site URLs', () => {
      const url = 'https://www.nytimes.com/2024/01/15/sports/basketball/bulls.html'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('nytimes.com')
    })

    it('should handle government URLs', () => {
      const url = 'https://www.sec.gov/news/press-release/2024-1'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('sec.gov')
    })

    it('should handle URLs with multiple www prefixes (edge case)', () => {
      const url = 'https://www.www.example.com/article'
      const domain = getDomainFromUrl(url)
      expect(domain).toBe('www.example.com') // Only first www is stripped
    })
  })
})

