import { isPdfLink } from '@/lib/learn/pdfLink'

describe('pdf links', () => {
  it('accepts a real file and a publisher path that ends in /pdf', () => {
    expect(isPdfLink('https://www.degruyter.com/document/doi/10.3138/9781487534554-004/pdf')).toBe(true)
    expect(isPdfLink('https://example.com/papers/chapter.pdf')).toBe(true)
    expect(isPdfLink('https://example.com/papers/chapter.pdf?download=1')).toBe(true)
    expect(isPdfLink('/topic-docs/cmws5kpc1001f4smg2tj8xm9t-abc123def456.pdf')).toBe(true)
  })

  it('rejects an ordinary page', () => {
    expect(isPdfLink('https://en.wikipedia.org/wiki/OpenID')).toBe(false)
    expect(isPdfLink('https://example.com/pdfs-are-interesting')).toBe(false)
    expect(isPdfLink('/topic-docs/notes.txt')).toBe(false)
  })
})
