import { textMatches } from '@/lib/groupSearch'

describe('group search', () => {
  it('finds a JFK question and a Kennedy title', () => {
    expect(textMatches("what was Israel's role in JFK's assassination", 'jfk assassination')).toBe(true)
    expect(textMatches('John F. Kennedy assassination conspiracy theories', 'jfk assassination')).toBe(true)
  })

  it('does not treat an unrelated title as a match', () => {
    expect(textMatches('How many dog beds did Mr Baxter gnaw his way through?', 'jfk assassination')).toBe(false)
    expect(textMatches('Summer League', 'jfk')).toBe(false)
  })
})
