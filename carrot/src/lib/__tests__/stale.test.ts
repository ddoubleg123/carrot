import { staleReason, storyDate } from '@/lib/curator/stale'

const NOW = Date.parse('2026-11-26T21:00:00Z')

test('an archive snapshot from last year is a dated story', () => {
  const date = storyDate({
    url: 'https://web.archive.org/web/20250401194912/https://thehill.com/homenews/senate/5226312-bipartisan-senators-introduce-primary-secondary-russia-sanctions/'
  })
  expect(date?.toISOString().slice(0, 10)).toBe('2025-04-01')
})

test('a current desk drops last year and a history desk keeps it', () => {
  const parts = {
    url: 'https://web.archive.org/web/20250401194912/https://thehill.com/story',
    text: 'Lindsey Graham and Richard Blumenthal introduced a bill on April 1, 2025.'
  }
  expect(staleReason(false, parts, NOW)).toBe('The article is from April 1, 2025. It is not a new story.')
  expect(staleReason(true, parts, NOW)).toBeNull()
})

test('a story from this month is still new', () => {
  expect(staleReason(false, { when: 'Tue, 20 Nov 2026 12:00:00 GMT' }, NOW)).toBeNull()
  expect(staleReason(false, { text: 'No date is written here at all.' }, NOW)).toBeNull()
})
