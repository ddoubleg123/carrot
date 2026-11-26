import { postRules, quoteIsExact } from '../curator/qa'
import { lowQualitySource, sourceCleared } from '../curator/cleared'
import { oneQuoteCard } from '../curator/quoteCardPick'

const SOURCE = 'Costa Rica put forward a candidate for UN secretary general. The Council votes Friday. The frontrunner could be stopped by a P5 veto.'

describe('a post has to match the source', () => {
  it('rejects a mood that names nobody', () => {
    const reasons = postRules('The line was the proof and the blank was the honest part, both at once.', SOURCE)
    expect(reasons.some((item) => item.reason === 'The post does not say who did what.')).toBe(true)
  })

  it('rejects a quotation that is not in the source', () => {
    const reasons = postRules('Costa Rica said "we will not look away from this vote."', SOURCE)
    expect(reasons.some((item) => item.reason === 'A quotation is not in the source.')).toBe(true)
  })

  it('rejects a number and a name the source does not have', () => {
    const reasons = postRules('Lewis Hamilton spent 12 days at the Rafah crossing.', SOURCE)
    expect(reasons.map((item) => item.reason)).toEqual(expect.arrayContaining([
      'The number 12 is not in the source.',
      'The name Lewis Hamilton is not in the source.'
    ]))
  })

  it('passes a post that stays inside the source', () => {
    expect(postRules('Costa Rica put forward a candidate, and a P5 veto could stop the frontrunner.', SOURCE)).toEqual([])
  })

  it('holds sexual harm involving a minor', () => {
    const reasons = postRules('A report describes child porn seized in the case.', SOURCE)
    expect(reasons[0]?.severity).toBe(1)
  })

  it('requires the card to use the source words', () => {
    expect(quoteIsExact('The Council votes Friday.', SOURCE)).toBe(true)
    expect(quoteIsExact('The Council might vote next week.', SOURCE)).toBe(false)
  })
})

describe('one card, and only a cleared source', () => {
  it('keeps a single photograph layout', () => {
    const chosen = oneQuoteCard([
      'https://x/o/quote-cards%2Fa__typeonly__sage.png?alt=media',
      'https://x/o/quote-cards%2Fa__split__butter.png?alt=media',
      'https://x/o/quote-cards%2Fa__poster__ink.png?alt=media'
    ])
    expect(chosen).toContain('__split__')
  })

  it('clears a government host and refuses a news site', () => {
    expect(sourceCleared('https://www.cdc.gov/story')).toBe(true)
    expect(sourceCleared('https://www.theguardian.com/world/x')).toBe(false)
    expect(lowQualitySource('https://www.draftkings.com/bet')).toBe(true)
  })
})
