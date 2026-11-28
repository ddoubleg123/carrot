const ALLOWED = new Set(['a', 'b', 'br', 'div', 'em', 'i', 'li', 'ol', 'p', 'strong', 'u', 'ul'])

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function safeHref(raw: string): string | null {
  const href = raw.trim()
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href
  return null
}

/** Keep bold, italic, lists, and links. Drop everything else. */
export function mailNote(raw: string): { text: string; html: string } {
  const stripped = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  const html = stripped.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, tag: string, attrs: string) => {
    const name = tag.toLowerCase()
    if (!ALLOWED.has(name)) return ''
    if (name === 'br') return '<br>'
    if (full.startsWith('</')) {
      const close = name === 'div' ? 'p' : name === 'strong' ? 'b' : name === 'em' ? 'i' : name
      return `</${close}>`
    }
    if (name === 'a') {
      const href = attrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
      const url = safeHref(href?.[1] || href?.[2] || href?.[3] || '')
      return url ? `<a href="${escapeHtml(url)}" style="color:#1a73e8;text-decoration:none;">` : ''
    }
    const open = name === 'div' ? 'p' : name === 'strong' ? 'b' : name === 'em' ? 'i' : name
    if (open === 'p') return '<p style="margin:0 0 14px;">'
    if (open === 'li') return '<li style="margin:0 0 4px;">'
    return `<${open}>`
  })
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text, html: text ? html : '' }
}
