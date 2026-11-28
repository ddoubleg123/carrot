export function isPdfLink(url: string): boolean {
  if (url.startsWith('/topic-docs/') && !url.includes('..')) return url.toLowerCase().endsWith('.pdf')
  try {
    const parsed = new URL(url)
    return parsed.pathname.toLowerCase().endsWith('.pdf') || /\/pdf(\/|$)/i.test(parsed.pathname) || /[?&](format|type)=pdf\b/i.test(parsed.search)
  } catch {
    return false
  }
}
