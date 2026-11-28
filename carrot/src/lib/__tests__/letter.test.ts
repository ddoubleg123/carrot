import { presentLetter } from '../mail/letter'

const RAW = `--000000000000bf9f4406614ceb2c
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

bro

On Fri, Nov 27, 2026 at 6:34=E2=80=AFPM Daniel Gouldman
wrote:

> yo man!
>
> > hey hey

--000000000000bf9f4406614ceb2c--`

describe('inbound letters', () => {
  it('keeps the new note and drops the mime wrapper', () => {
    const letter = presentLetter(RAW)
    expect(letter.text).toBe('bro')
    expect(letter.earlier).toContain('yo man!')
    expect(letter.earlier).toContain('hey hey')
    expect(letter.text).not.toContain('Content-Type')
    expect(letter.earlier).not.toContain('=E2')
    expect(letter.earlier).not.toContain('>')
  })

  it('reads the plain note inside a nested message', () => {
    const nested = `--outerboundary00000000000001
Content-Type: multipart/alternative; boundary="innerboundary00000000000002"

--innerboundary00000000000002
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

hello there

On Fri, Nov 27, 2026 at 6:34 PM Daniel
wrote:

> older note

--innerboundary00000000000002
Content-Type: text/html; charset="UTF-8"

<p>hello there</p>
--innerboundary00000000000002--
--outerboundary00000000000001--`
    const letter = presentLetter(nested)
    expect(letter.text).toBe('hello there')
    expect(letter.earlier).toContain('older note')
    expect(letter.text).not.toContain('Content-Type')
    expect(letter.text).not.toContain('--')
  })

  it('leaves a note we wrote untouched', () => {
    expect(presentLetter("you're my bestie bestie.")).toEqual({ text: "you're my bestie bestie.", earlier: '' })
  })
})
