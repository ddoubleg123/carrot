/** Turn a raw inbound letter into the note the person wrote, plus any quoted history. */

function decodeQuotedPrintable(value: string): string {
  const joined = value.replace(/=\r?\n/g, '')
  const bytes: number[] = []
  for (let i = 0; i < joined.length; i++) {
    const hex = joined.slice(i, i + 3)
    if (joined[i] === '=' && /^=[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex.slice(1), 16))
      i += 2
    } else {
      const code = joined.charCodeAt(i)
      if (code < 128) bytes.push(code)
      else bytes.push(...Buffer.from(joined[i], 'utf8'))
    }
  }
  return Buffer.from(bytes).toString('utf8')
}

function plainPart(raw: string): string {
  const plainHeader = raw.search(/Content-Type:[^\n]*text\/plain/i)
  if (plainHeader >= 0) {
    const after = raw.slice(plainHeader)
    const splitAt = after.search(/\r?\n\r?\n/)
    const head = splitAt >= 0 ? after.slice(0, splitAt) : ''
    let body = (splitAt >= 0 ? after.slice(splitAt) : after).replace(/\r/g, '')
    body = body.split(/\n--[^\n]+/)[0].replace(/\n--\s*$/g, '').trim()
    if (/quoted-printable/i.test(head) || /=[0-9A-Fa-f]{2}/.test(body)) body = decodeQuotedPrintable(body)
    return body.trim()
  }
  if (!/Content-Type:/i.test(raw) && !/Content-Transfer-Encoding:/i.test(raw)) return raw
  return raw.replace(/\r/g, '').trim()
}

function unwrapQuotes(value: string): string {
  return value
    .split('\n')
    .map((line) => line.replace(/^(?:>\s?)+/, '').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function presentLetter(raw: string): { text: string; earlier: string } {
  const plain = plainPart(raw || '').replace(/\r/g, '').trim()
  const quoteAt = plain.search(/\nOn [\s\S]{8,280}?wrote:\s*\n/)
  if (quoteAt < 0) return { text: plain, earlier: '' }
  const note = plain.slice(0, quoteAt).trim()
  const earlier = unwrapQuotes(plain.slice(quoteAt).replace(/^\nOn [\s\S]{8,280}?wrote:\s*\n/, ''))
  return { text: note || plain, earlier }
}
