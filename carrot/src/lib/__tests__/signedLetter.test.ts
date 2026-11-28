import { signedLetter } from '../mail/send'

describe('mail signature', () => {
  it('puts the account link and gotcarrot.com under the note', () => {
    const letter = signedLetter({ name: 'Daniel', username: 'daniel', text: 'Hello there.' })
    expect(letter.text).toContain('Hello there.')
    expect(letter.text).toContain('Daniel')
    expect(letter.text).toContain('https://gotcarrot.com/people/daniel')
    expect(letter.html).toContain('href="https://gotcarrot.com/people/daniel"')
    expect(letter.html).toContain('>Daniel</div>')
    expect(letter.html).toContain('>Email</td>')
    expect(letter.html).toContain('daniel@carro7.com')
    expect(letter.html).not.toContain('#f4f3f0')
  })

  it('escapes a note that contains markup', () => {
    const letter = signedLetter({ name: 'A <b>', username: 'a', text: 'Hi <script>' })
    expect(letter.html).toContain('Hi &lt;script&gt;')
    expect(letter.html).toContain('A &lt;b&gt;')
    expect(letter.html).not.toContain('<script>')
  })
})
