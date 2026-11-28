import { keptQuotes, notAQuote } from '../curator/keptQuote'

describe('quotes kept from a patch', () => {
  it('lifts a line a person wrote, with the speaker and the date in the text', () => {
    const text = 'On July 5, 1852, Frederick Douglass wrote, “This Fourth of July is yours, not mine.” The speech was delivered in Rochester.'
    expect(keptQuotes(text)[0]).toEqual({
      sentence: 'This Fourth of July is yours, not mine.',
      speaker: 'Frederick Douglass',
      date: 'July 5, 1852'
    })
  })

  it('keeps a line that still stands when the year is old', () => {
    const text = 'Martin Luther King Jr. wrote, “Injustice anywhere is a threat to justice everywhere.”'
    expect(keptQuotes(text)[0]).toMatchObject({
      sentence: 'Injustice anywhere is a threat to justice everywhere.',
      speaker: 'Martin Luther King Jr.'
    })
    const aurelius = '“The impediment to action advances action. What stands in the way becomes the way.” — Marcus Aurelius'
    expect(keptQuotes(aurelius).map((quote) => quote.sentence)).toContain('What stands in the way becomes the way.')
    expect(keptQuotes(aurelius)[0].speaker).toBe('Marcus Aurelius')
  })

  it('reads a transcript line that names the speaker', () => {
    const text = 'Frederick Douglass: This Fourth of July is yours, not mine. The hall was full.'
    expect(keptQuotes(text)[0]).toMatchObject({
      sentence: 'This Fourth of July is yours, not mine.',
      speaker: 'Frederick Douglass'
    })
  })

  it('leaves a news report, a score, a bill, and a caption on the page', () => {
    expect(notAQuote('Senators Lindsey Graham and Richard Blumenthal introduced the sanctions bill on Tuesday.')).toBe(true)
    expect(notAQuote('The Bills made a field goal as time expired in the game.')).toBe(true)
    expect(notAQuote('A girl on crutches walks past the rubble on Monday.')).toBe(true)
    expect(notAQuote('Subscribe to our newsletter for the full story from the desk.')).toBe(true)
    expect(keptQuotes('NASA said the rover drove for 8 kilometers across the crater floor on Monday.')).toEqual([])
    expect(keptQuotes('Officials said “Senators Lindsey Graham and Richard Blumenthal introduced the sanctions bill on Tuesday.”')).toEqual([])
  })

  it('does not invent a line that the text does not contain', () => {
    expect(keptQuotes('The page mentions Frederick Douglass and then talks about the weather in Rochester for a while.')).toEqual([])
  })
})
