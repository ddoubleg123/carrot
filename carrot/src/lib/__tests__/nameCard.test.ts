import { applyCardNames, bareWitness, brokenPost, editDistance, titledSurnames } from '@/lib/learn/nameCard'

const quote = 'I want to make sure that we get to a very clear answer from you that you will stand by, Mr. Cecilia, because you already tried to walk back the $10 billion contract.'

describe('name card', () => {
  it('treats Cecilia and Sicilia as the same missed name', () => {
    expect(editDistance('Cecilia', 'Sicilia')).toBe(2)
    expect(titledSurnames('Mr. Sicilia Oracie Corporation')).toEqual(['Sicilia'])
    expect(titledSurnames('M v. Sicilia Oracle')).toEqual(['Sicilia'])
    expect(applyCardNames(quote, 'M v. Sicilia Oracle')).toContain('Mr. Sicilia')
    expect(applyCardNames(quote, 'M v. Sicilia Oracle')).not.toContain('Cecilia')
    expect(applyCardNames('Miss Verma agreed.', 'Mr. Sicilia Oracle')).toBe('Miss Verma agreed.')
  })

  it('rejects a bare name followed by because', () => {
    expect(brokenPost('Cecilia, because you already tried to walk back the contract.')).toBe(true)
    expect(brokenPost(quote)).toBe(false)
    expect(bareWitness('Cecilia, you walked it back.', quote)).toBe(true)
    expect(bareWitness('Vikings got cute and it cost them.', quote)).toBe(false)
  })
})
