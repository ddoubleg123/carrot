import { quoteGrade, quotePost, quoteSentence, readQuote } from '../curator/quoteCard'
import { mediaKind } from '../mediaKind'

describe('quote cards', () => {
  it('keeps a whole sentence that names a thing', () => {
    const sentence = quoteSentence('The West Baray alone is a man-made lake that stretches for nearly 8 kilometers.')
    expect(sentence).toBe('The West Baray alone is a man-made lake that stretches for nearly 8 kilometers.')
  })

  it('drops a host intro, a filler, and a sentence that borrows its subject', () => {
    expect(quoteSentence("I'm joined now by Congressman Jamie Raskin of Maryland for this hearing.")).toBeNull()
    expect(quoteSentence('Uh, he is a senior fellow at the Yorktown Institute in Washington today.')).toBeNull()
    expect(quoteSentence('By the way, the New York Times will say they are against it.')).toBeNull()
    expect(quoteSentence('I was 16 and I was an intern in his first term as a state senator in that office.')).toBeNull()
    expect(quoteSentence('AI will create jobs more rapidly and it will displace jobs more rapidly than the prior ones.')).toBeNull()
    expect(quoteSentence('But every single one has created far more jobs than the last cycle did.')).toBeNull()
    expect(quoteSentence('We got here because of burning fossil fuels in the last century.')).toBeNull()
  })

  it('drops a recipe step even when it contains a number', () => {
    expect(quoteSentence('Heat the oven to 190C (170C fan)/375F/gas 5 and line two large baking trays.')).toBeNull()
    expect(quoteSentence('To serve about 20, he combines 600ml gin, 500ml fresh lemon juice, and 300ml gingerbread syrup in a jug.')).toBeNull()
  })

  it('drops a sentence that never says who or what it is about', () => {
    expect(quoteSentence('The five-time Grand Slam champion has not played competitively since winning Wimbledon on 12 July.')).toBeNull()
    expect(quoteSentence('The deal is for $80 million over five years with an opt-out after the third year, the New York Post reports.')).toBeNull()
  })

  it('rejects a card that is missing the source or the date', () => {
    const sentence = 'The West Baray alone is a man-made lake that stretches for nearly 8 kilometers.'
    expect(quoteGrade({ sentence, source: 'Cricket', date: 'March 3, 2024', image: '/a.jpg' }).pass).toBe(false)
    expect(quoteGrade({ sentence, source: 'BBC Sport', date: '', image: '/a.jpg' }).pass).toBe(false)
    expect(quoteGrade({ sentence, source: 'BBC Sport', date: 'March 3, 2024', image: '/a.jpg' }).pass).toBe(true)
  })

  it('does not use a fragment that was cut before the period', () => {
    expect(quoteSentence('The West Baray alone is a man-made lake that stretches')).toBeNull()
  })

  it('stores the sentence as its own card', () => {
    const body = quotePost('The West Baray alone is a man-made lake that stretches for nearly 8 kilometers.', 'A narration')
    expect(readQuote(body)?.sentence).toMatch(/8 kilometers\.$/)
    expect(readQuote(body)?.source).toBe('A narration')
    const dated = quotePost('The West Baray alone is a man-made lake that stretches for nearly 8 kilometers.', 'A narration', 'March 3, 2024')
    expect(readQuote(dated)?.date).toBe('March 3, 2024')
    expect(readQuote(dated)?.sentence).toMatch(/8 kilometers\.$/)
    expect(mediaKind({ content: body })).toBe('image')
  })
})