import { mailNote } from '../mail/noteHtml'

describe('mail formatting', () => {
  it('keeps bold and a real link', () => {
    const note = mailNote('<p>Hello <b>there</b></p><a href="https://gotcarrot.com">site</a>')
    expect(note.html).toContain('<b>there</b>')
    expect(note.html).toContain('href="https://gotcarrot.com"')
    expect(note.text).toContain('Hello there')
  })

  it('drops a script and a javascript link', () => {
    const note = mailNote('<p>Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>')
    expect(note.html).not.toContain('script')
    expect(note.html).not.toContain('javascript')
    expect(note.text).toContain('Hi')
    expect(note.text).not.toContain('alert')
  })
})
